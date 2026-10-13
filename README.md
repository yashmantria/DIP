# VisionDeblur Studio (OpenCV + React)

Interactive, high-performance image deblurring studio using frequency-domain deconvolution in OpenCV, featuring a modern React frontend and a FastAPI backend.

Features:
- **Interactive Split Slider & Side-by-Side Viewport**: Compare degraded and restored imagery in real time with pixel-perfect alignment.
- **Motion & Gaussian Point Spread Function (PSF)**: Real-time 2D PSF visualization with colorized heatmap and spectral response.
- **Wiener Filter & Inverse Filter**: Discrete Fourier Transform (DFT) deconvolution with customizable regularization factor $K$.
- **Edge Tapering**: Cosine-window attenuation to suppress boundary Gibbs ringing artifacts.
- **Luma-Only (YCrCb) Processing**: Deconvolve luminance only to preserve natural chromaticity and avoid color noise.
- **Simulation Lab**: Synthesize optical blur and additive Gaussian noise from sharp reference images, measuring ground-truth PSNR gains.
- **Fourier Theory & Math Guide**: Educational explanations of optical convolution, Wiener filtering, and frequency inversion.

---

## Project Architecture

```
Opencv_Image_Deblurring/
├── backend/                  # Python FastAPI restoration engine & algorithms
│   ├── server.py             # REST API server & static React host
│   ├── deblur_opencv.py      # Frequency-domain Wiener & Inverse deconvolution
│   ├── app.py                # Legacy Streamlit app
│   ├── requirements.txt      # Python dependencies
│   └── samples/              # Preloaded sample image datasets
├── frontend/                 # Modern React UI (Vite + Tailwind CSS + Lucide)
│   ├── src/                  # React components & UI logic
│   ├── dist/                 # Pre-built production distribution
│   ├── package.json          # Node dependencies & build scripts
│   └── vite.config.js        # Vite dev server & API proxy config
└── README.md
```

---

## Quick Start

### 1) Install dependencies

**Backend (Python):**
```bash
pip install -r backend/requirements.txt
```

**Frontend (React/Node):** *(Pre-built bundle is already included in `frontend/dist`)*
```bash
cd frontend
npm install
npm run build
cd ..
```

### 2) Launch VisionDeblur Studio
Run the unified FastAPI server from either the root or `backend/` directory:
```bash
python backend/server.py
```
*(or `cd backend && python server.py`)*

Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser.

### 3) Development Mode (Hot-Reloading)
To develop with live frontend hot-reloading:
- **Terminal 1 (Backend API):**
  ```bash
  cd backend
  python server.py
  ```
- **Terminal 2 (Frontend Dev Server):**
  ```bash
  cd frontend
  npm run dev
  ```
  Open **[http://127.0.0.1:5173](http://127.0.0.1:5173)** (API requests are automatically proxied to port 8000).

---

## Legacy Streamlit UI & CLI

### Streamlit App (Legacy)
```bash
cd backend
streamlit run app.py
```

### Command Line Interface (CLI)
```bash
cd backend

# Wiener filter with motion PSF
python deblur_opencv.py --input path/to/blurred.jpg --mode wiener --psf motion --length 25 --angle 10 --K 0.01

# Inverse filter with Gaussian PSF
python deblur_opencv.py --input path/to/blurred.png --mode inverse --psf gaussian --ksize 21 --sigma 4

# Simulate blur+noise from a sharp image, then deblur
python deblur_opencv.py --input path/to/sharp.jpg --simulate --psf motion --length 21 --angle 15 --mode wiener --K 0.02
```

## Notes
- Uses OpenCV DFT (`cv2.dft`) to operate in the frequency domain.
- Optional edge tapering reduces boundary ringing artifacts.
- Luma-only mode deconvolves only the Y channel in YCrCb to help avoid color artifacts.

## License
MIT

