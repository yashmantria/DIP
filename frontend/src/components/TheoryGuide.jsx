import React from 'react';
import { BookOpen, ShieldAlert, Zap, Compass, Layers, CheckCircle } from 'lucide-react';

export default function TheoryGuide() {
  return (
    <div className="theory-container">
      <div className="theory-hero">
        <h2 className="theory-title">Fourier Deconvolution & Digital Image Restoration</h2>
        <p className="theory-subtitle">
          Mathematical foundation of optical point spread function inversion, Wiener regularization, and spectral filtering implemented in OpenCV.
        </p>
      </div>

      <div className="theory-cards-grid">
        {/* Card 1: Forward Degradation Model */}
        <div className="theory-card">
          <h3 className="theory-card-title">
            <Compass size={18} color="var(--accent-primary)" />
            <span>1. Optical Degradation Model</span>
          </h3>
          <p className="theory-card-desc">
            In physical optics and camera imaging, motion shake or lens defocus is modeled as a 2D spatial convolution of the latent true scene $f(x,y)$ with the Point Spread Function (PSF) $h(x,y)$, plus additive sensor noise $n(x,y)$:
          </p>
          <div className="theory-math-block">
            g(x, y) = f(x, y) * h(x, y) + n(x, y)
          </div>
          <p className="theory-card-desc">
            By the <strong>Fourier Convolution Theorem</strong>, spatial convolution transforms into pointwise multiplication in the 2D frequency domain:
          </p>
          <div className="theory-math-block">
            G(u, v) = F(u, v) · H(u, v) + N(u, v)
          </div>
        </div>

        {/* Card 2: Inverse Filter */}
        <div className="theory-card">
          <h3 className="theory-card-title">
            <ShieldAlert size={18} color="var(--accent-rose)" />
            <span>2. Direct Inverse Filtering</span>
          </h3>
          <p className="theory-card-desc">
            The naive approach divides the observed spectrum by the Optical Transfer Function (OTF) $H(u,v)$:
          </p>
          <div className="theory-math-block">
            F̂_inv(u, v) = G(u, v) / H(u, v) = F(u, v) + [N(u, v) / H(u, v)]
          </div>
          <p className="theory-card-desc" style={{ color: '#fca5a5' }}>
            ⚠️ <strong>Instability:</strong> As high frequencies approach zeros in $H(u,v)$, the noise term $N(u,v)/H(u,v)$ blows up to infinity, flooding the restored image with intense high-frequency ringing and noise spikes.
          </p>
        </div>

        {/* Card 3: Wiener Filter */}
        <div className="theory-card">
          <h3 className="theory-card-title">
            <Zap size={18} color="var(--accent-emerald)" />
            <span>3. Wiener Filter (MMSE Optimum)</span>
          </h3>
          <p className="theory-card-desc">
            The Wiener filter minimizes the mean square error (MMSE) between the true image and the estimate by incorporating a regularization constant $K \approx S_n(u,v)/S_f(u,v)$ (Noise-to-Signal Power Ratio):
          </p>
          <div className="theory-math-block">
            F̂_wiener(u, v) = [ H*(u, v) / (|H(u, v)|² + K) ] · G(u, v)
          </div>
          <p className="theory-card-desc">
            When $|H(u,v)| \gg K$ (high signal region), the filter acts like the inverse filter. When $|H(u,v)| \to 0$ (near zeros), $K$ prevents division by zero and dampens noise amplification.
          </p>
        </div>

        {/* Card 4: Edge Tapering & Ringing */}
        <div className="theory-card">
          <h3 className="theory-card-title">
            <Layers size={18} color="var(--accent-secondary)" />
            <span>4. Edge Tapering (Cosine Window)</span>
          </h3>
          <p className="theory-card-desc">
            The Discrete Fourier Transform assumes circular periodicity. Sharp intensity discrepancies at image boundaries cause periodic wrap-around high-frequency ripples (Gibbs ringing).
          </p>
          <div className="theory-math-block">
            w(n) = 0.5 · (1 - cos(π · n / (α · N)))
          </div>
          <p className="theory-card-desc">
            Applying a raised-cosine edge taper window gently attenuates high-contrast step boundaries, drastically reducing border ripples in the restored output.
          </p>
        </div>
      </div>
    </div>
  );
}
