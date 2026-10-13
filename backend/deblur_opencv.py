#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image Restoration: Deblurring using Deconvolution (OpenCV)
- Inverse Filter
- Wiener Filter

CLI examples:
  python deblur_opencv.py --input blurred.jpg --mode wiener --psf motion --length 25 --angle 10 --K 0.01
  python deblur_opencv.py --input sharp.jpg --simulate --psf motion --length 21 --angle 15 --mode wiener --K 0.02
  python deblur_opencv.py --input blurred.png --mode inverse --psf gaussian --ksize 21 --sigma 4 --luma-only

Requires:
  pip install opencv-python numpy streamlit  # (streamlit optional)
"""
import os
import cv2
import sys
import math
import argparse
import numpy as np
from typing import Tuple

# ---------------------------
# Utility: safe mkdir
# ---------------------------
def ensure_dir(path: str):
    d = os.path.dirname(path)
    if d and not os.path.exists(d):
        os.makedirs(d, exist_ok=True)

# ---------------------------
# PSF builders
# ---------------------------
def psf_gaussian(ksize: int = 21, sigma: float = 5.0) -> np.ndarray:
    """Return normalized 2D Gaussian PSF."""
    if ksize % 2 == 0:
        ksize += 1
    ax = np.arange(-(ksize // 2), ksize // 2 + 1, dtype=np.float32)
    xx, yy = np.meshgrid(ax, ax)
    kernel = np.exp(-(xx**2 + yy**2) / (2.0 * sigma**2))
    kernel = kernel / (kernel.sum() + 1e-12)
    return kernel.astype(np.float32)

def psf_motion(length: int = 21, angle_deg: float = 0.0) -> np.ndarray:
    """Create a simple linear motion blur PSF (normalized)."""
    if length < 3:
        length = 3
    if length % 2 == 0:
        length += 1
    size = length
    kernel = np.zeros((size, size), dtype=np.float32)
    center = size // 2
    angle = np.deg2rad(angle_deg)
    cos_a, sin_a = np.cos(angle), np.sin(angle)

    # draw a line (Bresenham-like sampling along the motion direction)
    for t in range(-center, center + 1):
        x = center + int(round(t * cos_a))
        y = center + int(round(t * sin_a))
        if 0 <= y < size and 0 <= x < size:
            kernel[y, x] = 1.0
    s = kernel.sum()
    if s > 0:
        kernel /= s
    return kernel

# ---------------------------
# Edgetaper (cosine window)
# ---------------------------
def cosine_window(h: int, w: int, alpha: float = 0.2) -> np.ndarray:
    """2D raised-cosine window to taper edges (reduce ringing)."""
    def one_dim(n):
        t = np.linspace(0, 1, n, dtype=np.float32)
        win = np.ones_like(t)
        m = int(np.floor(alpha * (n - 1) / 2.0))
        if m > 0:
            left = 0.5 * (1 - np.cos(np.pi * np.linspace(0, 1, m*2+1)))
            right = left[::-1]
            win[:m+1] = left[:m+1]
            win[-(m+1):] = right[:m+1]
        return win
    wy = one_dim(h)[:, None]
    wx = one_dim(w)[None, :]
    return (wy * wx).astype(np.float32)

def apply_edgetaper(img: np.ndarray, alpha: float = 0.2) -> np.ndarray:
    """Multiply image by a cosine window near borders."""
    h, w = img.shape[:2]
    win = cosine_window(h, w, alpha)
    if img.ndim == 2:
        return (img * win).astype(np.float32)
    out = img.astype(np.float32).copy()
    for c in range(img.shape[2]):
        out[..., c] *= win
    return out

# ---------------------------
# PSF -> OTF (frequency response via cv2.dft)
# ---------------------------
def psf2otf(psf: np.ndarray, shape: Tuple[int, int]) -> np.ndarray:
    """Pad PSF to image shape and circularly shift so its center is at (0,0)."""
    hh, ww = shape
    kh, kw = psf.shape[:2]
    otf = np.zeros((hh, ww), dtype=np.float32)
    # pad PSF to top-left
    otf[:kh, :kw] = psf.astype(np.float32)
    # circular shift to center at (0,0) for convolution theorem
    otf = np.roll(otf, -kh // 2, axis=0)
    otf = np.roll(otf, -kw // 2, axis=1)
    # to complex FFT
    otf = cv2.dft(otf, flags=cv2.DFT_COMPLEX_OUTPUT)
    return otf  # shape (H,W,2)

# ---------------------------
# Complex helpers (on 2-channel images)
# ---------------------------
def complex_mul(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    ar, ai = a[..., 0], a[..., 1]
    br, bi = b[..., 0], b[..., 1]
    real = ar * br - ai * bi
    imag = ar * bi + ai * br
    return np.dstack((real, imag))

def complex_conj(a: np.ndarray) -> np.ndarray:
    return np.dstack((a[..., 0], -a[..., 1]))

def complex_abs2(a: np.ndarray) -> np.ndarray:
    return a[..., 0] ** 2 + a[..., 1] ** 2

def complex_div(a: np.ndarray, b: np.ndarray, eps: float = 1e-8) -> np.ndarray:
    """a / b for complex 2-channel matrices."""
    ar, ai = a[..., 0], a[..., 1]
    br, bi = b[..., 0], b[..., 1]
    denom = br * br + bi * bi
    denom = np.maximum(denom, eps)
    real = (ar * br + ai * bi) / denom
    imag = (ai * br - ar * bi) / denom
    return np.dstack((real, imag))

# ---------------------------
# Forward / inverse DFT
# ---------------------------
def fft2(img: np.ndarray) -> np.ndarray:
    return cv2.dft(img.astype(np.float32), flags=cv2.DFT_COMPLEX_OUTPUT)

def ifft2(freq: np.ndarray) -> np.ndarray:
    # return real output
    return cv2.idft(freq, flags=cv2.DFT_SCALE | cv2.DFT_REAL_OUTPUT)

# ---------------------------
# Deconvolution cores
# ---------------------------
def inverse_filter_channel(blurred: np.ndarray, H: np.ndarray, eps: float = 1e-3) -> np.ndarray:
    """Inverse filtering on a single channel (float32, shape HxW)."""
    G = fft2(blurred)
    # stabilize: threshold very small |H|
    HrHi = H.copy()
    mag2 = complex_abs2(HrHi)
    mask = mag2 < (eps ** 2)
    # replace tiny frequencies with eps on real part, zero imag
    HrHi[..., 0][mask] = eps
    HrHi[..., 1][mask] = 0.0
    Fhat = complex_div(G, HrHi, eps=eps)
    f = ifft2(Fhat)
    return f

def wiener_filter_channel(blurred: np.ndarray, H: np.ndarray, K: float = 0.01) -> np.ndarray:
    """Wiener filtering on a single channel (float32, shape HxW)."""
    G = fft2(blurred)
    H_conj = complex_conj(H)
    denom = complex_abs2(H) + K
    # divide H* by denom (real scalar per frequency)
    W = np.dstack((H_conj[..., 0] / denom, H_conj[..., 1] / denom))
    Fhat = complex_mul(W, G)
    f = ifft2(Fhat)
    return f

def deconvolve(blurred_bgr: np.ndarray,
               psf: np.ndarray,
               mode: str = "wiener",
               K: float = 0.01,
               luma_only: bool = False,
               edgetaper_alpha: float = 0.0) -> np.ndarray:
    """
    Deconvolve image using inverse or wiener filter.
    - blurred_bgr: uint8 BGR image
    - psf: 2D float32 kernel
    - mode: 'inverse' or 'wiener'
    - K: Wiener regularization
    - luma_only: if True, deconvolve only Y channel in YCrCb
    - edgetaper_alpha: if >0, apply cosine edge tapering before FFT
    """
    h, w = blurred_bgr.shape[:2]
    Hfreq = psf2otf(psf, (h, w))

    if luma_only:
        ycrcb = cv2.cvtColor(blurred_bgr, cv2.COLOR_BGR2YCrCb)
        y = ycrcb[..., 0].astype(np.float32)
        if edgetaper_alpha > 0:
            y = apply_edgetaper(y, edgetaper_alpha)
        if mode == "inverse":
            out_y = inverse_filter_channel(y, Hfreq)
        else:
            out_y = wiener_filter_channel(y, Hfreq, K)
        out_y = np.clip(out_y, 0, 255).astype(np.uint8)
        ycrcb[..., 0] = out_y
        return cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)
    else:
        img = blurred_bgr.astype(np.float32)
        if edgetaper_alpha > 0:
            img = apply_edgetaper(img, edgetaper_alpha)
        channels = cv2.split(img)
        out_ch = []
        for ch in channels:
            if mode == "inverse":
                rec = inverse_filter_channel(ch, Hfreq)
            else:
                rec = wiener_filter_channel(ch, Hfreq, K)
            out_ch.append(np.clip(rec, 0, 255).astype(np.uint8))
        return cv2.merge(out_ch)

# ---------------------------
# Blur simulator (for testing)
# ---------------------------
def convolve_spatial(img: np.ndarray, psf: np.ndarray) -> np.ndarray:
    """Spatial-domain convolution via filter2D (circular-ish if you pad)."""
    # Use BORDER_REPLICATE to avoid black borders (not perfect, but okay)
    if img.ndim == 2:
        out = cv2.filter2D(img, -1, psf, borderType=cv2.BORDER_REPLICATE)
        return out
    outs = [cv2.filter2D(img[..., c], -1, psf, borderType=cv2.BORDER_REPLICATE) for c in range(3)]
    return cv2.merge(outs)

def add_gauss_noise(img: np.ndarray, sigma: float = 6.0) -> np.ndarray:
    noise = np.random.normal(0.0, sigma, img.shape).astype(np.float32)
    noisy = img.astype(np.float32) + noise
    return np.clip(noisy, 0, 255).astype(np.uint8)

# ---------------------------
# CLI
# ---------------------------
def parse_args():
    p = argparse.ArgumentParser(description="Deblur images with inverse/Wiener deconvolution (OpenCV).")
    p.add_argument("--input", required=True, help="Path to input image (blurred image, or sharp if --simulate).")
    p.add_argument("--output", default="outputs/result.png", help="Where to save result image.")
    p.add_argument("--mode", choices=["inverse", "wiener"], default="wiener", help="Deconvolution type.")
    p.add_argument("--K", type=float, default=0.01, help="Wiener regularization (noise-to-signal power ratio).")
    p.add_argument("--psf", choices=["motion", "gaussian"], default="motion", help="PSF type.")
    p.add_argument("--length", type=int, default=21, help="Motion PSF length (odd).")
    p.add_argument("--angle", type=float, default=0.0, help="Motion PSF angle (degrees).")
    p.add_argument("--ksize", type=int, default=21, help="Gaussian PSF size (odd).")
    p.add_argument("--sigma", type=float, default=5.0, help="Gaussian PSF sigma.")
    p.add_argument("--luma-only", action="store_true", help="Deblur Y (luma) channel only in YCrCb.")
    p.add_argument("--edgetaper", type=float, default=0.0, help="Cosine edgetaper alpha (0 disables).")
    p.add_argument("--simulate", action="store_true", help="Treat input as SHARP, blur + noise for demo, then deblur.")
    p.add_argument("--noise-sigma", type=float, default=6.0, help="Gaussian noise sigma for --simulate.")
    return p.parse_args()

def main():
    args = parse_args()
    ensure_dir(args.output)
    bgr = cv2.imread(args.input, cv2.IMREAD_COLOR)
    if bgr is None:
        print("ERROR: Could not read:", args.input)
        sys.exit(1)

    # Build PSF
    if args.psf == "motion":
        psf = psf_motion(args.length, args.angle)
        psf_name = f"motion_L{args.length}_A{args.angle}"
    else:
        psf = psf_gaussian(args.ksize, args.sigma)
        psf_name = f"gauss_K{args.ksize}_S{args.sigma}"

    if args.simulate:
        # simulate blur + noise from a sharp input
        blurred = convolve_spatial(bgr, psf)
        noisy = add_gauss_noise(blurred, sigma=args.noise_sigma)
        to_restore = noisy
        # Save intermediates for inspection
        base = os.path.splitext(args.output)[0]
        ensure_dir(base + "_dummy.png")
        cv2.imwrite(base + "_original.png", bgr)
        cv2.imwrite(base + "_blurred.png", blurred)
        cv2.imwrite(base + "_noisy.png", noisy)
        print(f"[simulate] wrote: {base}_original.png / _blurred.png / _noisy.png")
    else:
        to_restore = bgr

    mode = args.mode.lower()
    restored = deconvolve(
        to_restore,
        psf=psf,
        mode=mode,
        K=args.K,
        luma_only=args.luma_only,
        edgetaper_alpha=args.edgetaper
    )

    # Save result
    tag = f"{mode}_{psf_name}"
    if args.luma_only:
        tag += "_luma"
    if args.edgetaper > 0:
        tag += f"_taper{args.edgetaper}"
    base_out, ext = os.path.splitext(args.output)
    out_path = f"{base_out}_{tag}{ext if ext else '.png'}"
    ensure_dir(out_path)
    cv2.imwrite(out_path, restored)
    print("Saved:", out_path)

if __name__ == "__main__":
    main()
