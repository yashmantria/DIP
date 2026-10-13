#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FastAPI Backend for OpenCV Image Deblurring
Replaces the Streamlit interface with a high-performance REST API.
"""

import os
import io
import time
import math
import base64
from typing import Optional, List
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

from deblur_opencv import (
    psf_motion,
    psf_gaussian,
    deconvolve,
    convolve_spatial,
    add_gauss_noise,
)

app = FastAPI(
    title="OpenCV Image Deblurring API",
    description="Deconvolution-based image restoration engine using OpenCV",
    version="2.0.0"
)

# Enable CORS for React frontend (Vite default :5173, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLES_DIR = os.path.join(BASE_DIR, "samples")
if not os.path.exists(SAMPLES_DIR):
    SAMPLES_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "samples"))


# ---------------------------
# Utility Functions
# ---------------------------
def compute_laplacian_sharpness(img_bgr: np.ndarray) -> float:
    """Laplacian variance as a benchmark metric for image sharpness."""
    if img_bgr is None or img_bgr.size == 0:
        return 0.0
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    val = cv2.Laplacian(gray, cv2.CV_64F).var()
    return float(round(val, 2))


def compute_psnr(img_true: np.ndarray, img_test: np.ndarray) -> float:
    """Peak Signal-to-Noise Ratio between two images."""
    if img_true.shape != img_test.shape:
        return 0.0
    mse = np.mean((img_true.astype(np.float64) - img_test.astype(np.float64)) ** 2)
    if mse <= 1e-10:
        return 99.99
    return float(round(20 * math.log10(255.0 / math.sqrt(mse)), 2))


def image_to_base64(img_bgr: np.ndarray, ext: str = ".png") -> str:
    """Encode OpenCV BGR image into Base64 PNG data URL."""
    success, buffer = cv2.imencode(ext, img_bgr)
    if not success:
        raise ValueError("Failed to encode image to buffer")
    b64_str = base64.b64encode(buffer).decode("utf-8")
    mime = "image/png" if ext.lower() == ".png" else "image/jpeg"
    return f"data:{mime};base64,{b64_str}"


def base64_to_image(b64_str: str) -> np.ndarray:
    """Decode Base64 string into OpenCV BGR image."""
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    data = base64.b64decode(b64_str)
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image from Base64")
    return img


def render_psf_visualization(psf: np.ndarray, size: int = 140) -> str:
    """Create a rich colorized visualization of the PSF kernel."""
    psf_norm = psf.copy()
    pmin, pmax = psf_norm.min(), psf_norm.max()
    if pmax > pmin:
        psf_norm = (psf_norm - pmin) / (pmax - pmin)
    else:
        psf_norm = np.zeros_like(psf_norm)
    psf_u8 = (psf_norm * 255).astype(np.uint8)
    
    # Scale up with nearest neighbor for pixel grid view
    upscaled = cv2.resize(psf_u8, (size, size), interpolation=cv2.INTER_NEAREST)
    
    # Colorize with magma/inferno colormap
    colorized = cv2.applyColorMap(upscaled, cv2.COLORMAP_INFERNO)
    return image_to_base64(colorized, ".png")


def resize_if_huge(img: np.ndarray, max_dim: int = 1600) -> np.ndarray:
    """Downscale very large images to prevent excessive memory & keep processing snappy."""
    h, w = img.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / float(max(h, w))
        return cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


# ---------------------------
# API Schemas
# ---------------------------
class PSFPreviewRequest(BaseModel):
    psf_type: str = "motion"  # "motion" | "gaussian"
    length: int = 21
    angle: float = 0.0
    ksize: int = 21
    sigma: float = 5.0


class DeblurJSONRequest(BaseModel):
    image_base64: str
    psf_type: str = "motion"
    length: int = 21
    angle: float = 0.0
    ksize: int = 21
    sigma: float = 5.0
    mode: str = "wiener"  # "wiener" | "inverse"
    K: float = 0.01
    luma_only: bool = True
    edgetaper_alpha: float = 0.2


class SimulateJSONRequest(BaseModel):
    image_base64: str
    psf_type: str = "motion"
    length: int = 25
    angle: float = 15.0
    ksize: int = 21
    sigma: float = 4.5
    noise_sigma: float = 2.0
    mode: str = "wiener"
    K: float = 0.01
    luma_only: bool = True
    edgetaper_alpha: float = 0.2


# ---------------------------
# Endpoints
# ---------------------------
@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "engine": "OpenCV Python Deconvolution Engine",
        "opencv_version": cv2.__version__,
        "numpy_version": np.__version__
    }


@app.get("/api/samples")
def get_samples():
    """Return available pre-configured sample datasets."""
    samples = [
        {
            "id": "sample_camera_motion",
            "title": "Vintage Camera (Motion Blur)",
            "description": "Simulated horizontal/angled camera shake with noise. Restorable via Motion PSF Wiener filtering.",
            "file": "camera_motion_blur.png",
            "sharp_file": "camera_sharp.jpg",
            "psf_type": "motion",
            "length": 25,
            "angle": 20.0,
            "ksize": 21,
            "sigma": 5.0,
            "mode": "wiener",
            "K": 0.008,
            "luma_only": True,
            "edgetaper_alpha": 0.25
        },
        {
            "id": "sample_street_gaussian",
            "title": "Deblurring Ave (Gaussian Blur)",
            "description": "Urban sign with atmospheric / out-of-focus Gaussian blur. Restorable via Gaussian PSF.",
            "file": "street_gaussian_blur.png",
            "sharp_file": "street_sharp.jpg",
            "psf_type": "gaussian",
            "length": 21,
            "angle": 0.0,
            "ksize": 21,
            "sigma": 4.5,
            "mode": "wiener",
            "K": 0.005,
            "luma_only": True,
            "edgetaper_alpha": 0.2
        },
        {
            "id": "sample_camera_sharp",
            "title": "Sharp Vintage Camera (For Simulation)",
            "description": "Crystal sharp reference photo ready for blur simulation and restoration experiments.",
            "file": "camera_sharp.jpg",
            "sharp_file": "camera_sharp.jpg",
            "psf_type": "motion",
            "length": 21,
            "angle": 0.0,
            "ksize": 21,
            "sigma": 5.0,
            "mode": "wiener",
            "K": 0.01,
            "luma_only": True,
            "edgetaper_alpha": 0.2
        }
    ]
    return {"samples": samples}


@app.get("/samples/{filename}")
def serve_sample_file(filename: str):
    path = os.path.join(SAMPLES_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Sample image not found")
    media_type = "image/png" if filename.lower().endswith(".png") else "image/jpeg"
    return FileResponse(path, media_type=media_type)


@app.post("/api/psf-preview")
def preview_psf(req: PSFPreviewRequest):
    """Generate real-time PSF visualization without full image deconvolution."""
    if req.psf_type == "motion":
        length = max(3, req.length)
        if length % 2 == 0:
            length += 1
        psf = psf_motion(length, req.angle)
        name = f"Motion PSF (L={length}, angle={req.angle} deg)"
    else:
        ksize = max(3, req.ksize)
        if ksize % 2 == 0:
            ksize += 1
        psf = psf_gaussian(ksize, req.sigma)
        name = f"Gaussian PSF (Kernel={ksize}x{ksize}, sigma={req.sigma})"

    psf_b64 = render_psf_visualization(psf)
    return {
        "psf_name": name,
        "psf_shape": list(psf.shape),
        "psf_image": psf_b64,
        "psf_sum": float(round(psf.sum(), 4))
    }


def process_deblur_core(
    bgr: np.ndarray,
    psf_type: str,
    length: int,
    angle: float,
    ksize: int,
    sigma: float,
    mode: str,
    K: float,
    luma_only: bool,
    edgetaper_alpha: float
):
    bgr = resize_if_huge(bgr)
    t0 = time.perf_counter()

    # Build PSF
    if psf_type == "motion":
        length_val = max(3, int(length))
        if length_val % 2 == 0:
            length_val += 1
        psf = psf_motion(length_val, float(angle))
        psf_name = f"Motion L={length_val}, angle={angle} deg"
    else:
        ksize_val = max(3, int(ksize))
        if ksize_val % 2 == 0:
            ksize_val += 1
        psf = psf_gaussian(ksize_val, float(sigma))
        psf_name = f"Gaussian K={ksize_val}, sigma={sigma}"

    orig_sharpness = compute_laplacian_sharpness(bgr)

    # Perform Deconvolution
    restored = deconvolve(
        bgr,
        psf=psf,
        mode=mode.lower(),
        K=float(K),
        luma_only=bool(luma_only),
        edgetaper_alpha=float(edgetaper_alpha)
    )

    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    restored_sharpness = compute_laplacian_sharpness(restored)

    orig_b64 = image_to_base64(bgr, ".png")
    restored_b64 = image_to_base64(restored, ".png")
    psf_b64 = render_psf_visualization(psf)

    sharpness_gain = 0.0
    if orig_sharpness > 0:
        sharpness_gain = round(((restored_sharpness - orig_sharpness) / orig_sharpness) * 100, 1)

    return {
        "original_image": orig_b64,
        "restored_image": restored_b64,
        "psf_image": psf_b64,
        "metrics": {
            "execution_time_ms": round(elapsed_ms, 1),
            "width": bgr.shape[1],
            "height": bgr.shape[0],
            "channels": bgr.shape[2],
            "original_sharpness": orig_sharpness,
            "restored_sharpness": restored_sharpness,
            "sharpness_gain_pct": sharpness_gain,
            "psf_name": psf_name,
            "mode": mode.upper(),
            "regularization_K": K if mode == "wiener" else None,
            "luma_only": luma_only,
            "edgetaper_alpha": edgetaper_alpha
        }
    }


@app.post("/api/deblur")
async def deblur_image(
    file: Optional[UploadFile] = File(None),
    psf_type: str = Form("motion"),
    length: int = Form(21),
    angle: float = Form(0.0),
    ksize: int = Form(21),
    sigma: float = Form(5.0),
    mode: str = Form("wiener"),
    K: float = Form(0.01),
    luma_only: bool = Form(True),
    edgetaper_alpha: float = Form(0.2)
):
    """Multipart upload deblur endpoint."""
    if file is None:
        raise HTTPException(status_code=400, detail="No image file provided")
    contents = await file.read()
    arr = np.frombuffer(contents, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid decodable image")

    res = process_deblur_core(
        bgr, psf_type, length, angle, ksize, sigma, mode, K, luma_only, edgetaper_alpha
    )
    return res


@app.post("/api/deblur-json")
def deblur_image_json(req: DeblurJSONRequest):
    """JSON payload deblur endpoint (allows direct Base64 images)."""
    try:
        bgr = base64_to_image(req.image_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {str(e)}")

    res = process_deblur_core(
        bgr, req.psf_type, req.length, req.angle, req.ksize, req.sigma,
        req.mode, req.K, req.luma_only, req.edgetaper_alpha
    )
    return res


@app.post("/api/simulate")
async def simulate_and_restore(
    file: Optional[UploadFile] = File(None),
    psf_type: str = Form("motion"),
    length: int = Form(25),
    angle: float = Form(15.0),
    ksize: int = Form(21),
    sigma: float = Form(4.5),
    noise_sigma: float = Form(2.0),
    mode: str = Form("wiener"),
    K: float = Form(0.01),
    luma_only: bool = Form(True),
    edgetaper_alpha: float = Form(0.2)
):
    """
    Simulation mode: takes a sharp image, synthesizes PSF blur and noise,
    then executes restoration and computes ground-truth PSNR metrics.
    """
    if file is None:
        raise HTTPException(status_code=400, detail="No image file provided")
    contents = await file.read()
    arr = np.frombuffer(contents, dtype=np.uint8)
    bgr_sharp = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr_sharp is None:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid decodable image")

    return run_simulation_core(
        bgr_sharp, psf_type, length, angle, ksize, sigma, noise_sigma,
        mode, K, luma_only, edgetaper_alpha
    )


@app.post("/api/simulate-json")
def simulate_and_restore_json(req: SimulateJSONRequest):
    try:
        bgr_sharp = base64_to_image(req.image_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {str(e)}")

    return run_simulation_core(
        bgr_sharp, req.psf_type, req.length, req.angle, req.ksize, req.sigma, req.noise_sigma,
        req.mode, req.K, req.luma_only, req.edgetaper_alpha
    )


def run_simulation_core(
    bgr_sharp: np.ndarray,
    psf_type: str,
    length: int,
    angle: float,
    ksize: int,
    sigma: float,
    noise_sigma: float,
    mode: str,
    K: float,
    luma_only: bool,
    edgetaper_alpha: float
):
    bgr_sharp = resize_if_huge(bgr_sharp)
    t0 = time.perf_counter()

    # 1. Build PSF
    if psf_type == "motion":
        length_val = max(3, int(length))
        if length_val % 2 == 0:
            length_val += 1
        psf = psf_motion(length_val, float(angle))
        psf_name = f"Motion L={length_val}, angle={angle} deg"
    else:
        ksize_val = max(3, int(ksize))
        if ksize_val % 2 == 0:
            ksize_val += 1
        psf = psf_gaussian(ksize_val, float(sigma))
        psf_name = f"Gaussian K={ksize_val}, sigma={sigma}"

    # 2. Convolve sharp image to simulate blur
    blurred = convolve_spatial(bgr_sharp, psf)

    # 3. Add additive Gaussian noise if noise_sigma > 0
    if noise_sigma > 0:
        blurred_noisy = add_gauss_noise(blurred, sigma=float(noise_sigma))
    else:
        blurred_noisy = blurred

    # 4. Deconvolve back
    restored = deconvolve(
        blurred_noisy,
        psf=psf,
        mode=mode.lower(),
        K=float(K),
        luma_only=bool(luma_only),
        edgetaper_alpha=float(edgetaper_alpha)
    )

    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    # 5. Metrics
    sharp_sharpness = compute_laplacian_sharpness(bgr_sharp)
    blurred_sharpness = compute_laplacian_sharpness(blurred_noisy)
    restored_sharpness = compute_laplacian_sharpness(restored)

    psnr_blurred = compute_psnr(bgr_sharp, blurred_noisy)
    psnr_restored = compute_psnr(bgr_sharp, restored)
    psnr_gain = round(psnr_restored - psnr_blurred, 2)

    return {
        "sharp_image": image_to_base64(bgr_sharp, ".png"),
        "blurred_image": image_to_base64(blurred_noisy, ".png"),
        "restored_image": image_to_base64(restored, ".png"),
        "psf_image": render_psf_visualization(psf),
        "metrics": {
            "execution_time_ms": round(elapsed_ms, 1),
            "width": bgr_sharp.shape[1],
            "height": bgr_sharp.shape[0],
            "psf_name": psf_name,
            "psnr_blurred_db": psnr_blurred,
            "psnr_restored_db": psnr_restored,
            "psnr_gain_db": psnr_gain,
            "noise_sigma": noise_sigma,
            "sharpness_sharp": sharp_sharpness,
            "sharpness_blurred": blurred_sharpness,
            "sharpness_restored": restored_sharpness,
            "mode": mode.upper(),
            "regularization_K": K if mode == "wiener" else None,
            "luma_only": luma_only,
            "edgetaper_alpha": edgetaper_alpha
        }
    }


# ---------------------------
# Static React Frontend Serving
# ---------------------------
FRONTEND_DIST = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "dist"))
if not os.path.exists(FRONTEND_DIST):
    FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")

if os.path.exists(FRONTEND_DIST):
    from fastapi.staticfiles import StaticFiles
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    def serve_react_root():
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"message": "OpenCV Deblurring API is online. Build frontend to view UI."}


if __name__ == "__main__":
    import sys
    import uvicorn
    if BASE_DIR not in sys.path:
        sys.path.insert(0, BASE_DIR)
    print("\n========================================================")
    print("  VisionDeblur Studio (OpenCV + React)")
    print("  Server URL: http://127.0.0.1:8000")
    print("========================================================\n")
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True, app_dir=BASE_DIR)

