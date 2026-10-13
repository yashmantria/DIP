# app.py
import cv2
import numpy as np
import streamlit as st
from deblur_opencv import psf_motion, psf_gaussian, deconvolve

st.set_page_config(page_title="Deblurring: Inverse & Wiener (OpenCV)", layout="wide")
st.title("Image Deblurring with Deconvolution (OpenCV)")

uploaded = st.file_uploader("Upload a blurry image", type=["png","jpg","jpeg","bmp","tif","tiff"])
col1, col2 = st.columns(2)

with st.sidebar:
    st.header("PSF")
    psf_type = st.selectbox("Type", ["motion", "gaussian"])
    if psf_type == "motion":
        length = st.slider("Length", 3, 151, 21, step=2)
        angle = st.slider("Angle (deg)", -90, 90, 0)
        psf = psf_motion(length, angle)
    else:
        ksize = st.slider("Kernel size", 3, 151, 21, step=2)
        sigma = st.slider("Sigma", 0.5, 20.0, 5.0)
        psf = psf_gaussian(ksize, sigma)

    st.header("Deconvolution")
    mode = st.selectbox("Mode", ["wiener", "inverse"])
    K = st.slider("Wiener K", 0.0001, 0.5, 0.01, step=0.0001) if mode=="wiener" else 0.01
    luma_only = st.checkbox("Luma-only (Y channel)", value=True)
    taper = st.slider("Edge taper α", 0.0, 0.5, 0.2, step=0.05)

if uploaded is not None:
    file_bytes = np.asarray(bytearray(uploaded.read()), dtype=np.uint8)
    bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    with col1:
        st.subheader("Input")
        st.image(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), channels="RGB")

    restored = deconvolve(bgr, psf, mode=mode, K=K, luma_only=luma_only, edgetaper_alpha=taper)
    with col2:
        st.subheader("Restored")
        st.image(cv2.cvtColor(restored, cv2.COLOR_BGR2RGB), channels="RGB")

    # Download
    ok = cv2.imencode(".png", restored)[1].tobytes()
    st.download_button("Download restored image", data=ok, file_name="restored.png", mime="image/png")
else:
    st.info("Upload a blurry image to get started.")
