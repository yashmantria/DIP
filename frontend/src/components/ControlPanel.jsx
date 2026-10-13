import React, { useEffect, useState } from 'react';
import { 
  Sliders, 
  Compass, 
  Activity, 
  Zap, 
  RotateCcw, 
  Layers, 
  ShieldCheck, 
  Eye, 
  HelpCircle 
} from 'lucide-react';

export default function ControlPanel({
  params,
  setParams,
  onDeblur,
  loading,
  hasImage,
  onReset
}) {
  const [psfPreview, setPsfPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Fetch real-time PSF preview when PSF parameters change
  useEffect(() => {
    const fetchPsf = async () => {
      try {
        setPreviewLoading(true);
        const res = await fetch('/api/psf-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            psf_type: params.psf_type,
            length: parseInt(params.length),
            angle: parseFloat(params.angle),
            ksize: parseInt(params.ksize),
            sigma: parseFloat(params.sigma)
          })
        });
        if (res.ok) {
          const data = await res.json();
          setPsfPreview(data);
        }
      } catch (err) {
        console.error('Failed to preview PSF:', err);
      } finally {
        setPreviewLoading(false);
      }
    };

    const timer = setTimeout(fetchPsf, 80);
    return () => clearTimeout(timer);
  }, [params.psf_type, params.length, params.angle, params.ksize, params.sigma]);

  const updateParam = (key, val) => {
    setParams(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="control-panel">
      {/* 1. Point Spread Function (PSF) Section */}
      <div>
        <div className="section-header">
          <h2 className="section-title">
            <Compass size={18} color="var(--accent-primary)" />
            <span>Point Spread Function</span>
          </h2>
          <span className="section-badge">PSF Model</span>
        </div>

        {/* PSF Type Switcher */}
        <div className="segmented-control" role="group" aria-label="PSF Type">
          <button
            id="psf-type-motion"
            type="button"
            className={`segment-btn ${params.psf_type === 'motion' ? 'active' : ''}`}
            onClick={() => updateParam('psf_type', 'motion')}
          >
            <span>Motion Blur</span>
          </button>
          <button
            id="psf-type-gaussian"
            type="button"
            className={`segment-btn ${params.psf_type === 'gaussian' ? 'active' : ''}`}
            onClick={() => updateParam('psf_type', 'gaussian')}
          >
            <span>Gaussian Blur</span>
          </button>
        </div>

        {params.psf_type === 'motion' ? (
          <>
            {/* Motion Length */}
            <div className="control-group">
              <div className="control-label-row">
                <span className="control-label">Motion Length (px)</span>
                <span className="control-val-badge">{params.length} px</span>
              </div>
              <input
                id="slider-motion-length"
                type="range"
                className="range-slider"
                min="3"
                max="151"
                step="2"
                value={params.length}
                onChange={(e) => updateParam('length', parseInt(e.target.value))}
              />
            </div>

            {/* Motion Angle */}
            <div className="control-group">
              <div className="control-label-row">
                <span className="control-label">Motion Angle (deg)</span>
                <span className="control-val-badge">{params.angle}°</span>
              </div>
              <input
                id="slider-motion-angle"
                type="range"
                className="range-slider"
                min="-90"
                max="90"
                step="1"
                value={params.angle}
                onChange={(e) => updateParam('angle', parseFloat(e.target.value))}
              />
            </div>
          </>
        ) : (
          <>
            {/* Gaussian Kernel Size */}
            <div className="control-group">
              <div className="control-label-row">
                <span className="control-label">Kernel Size</span>
                <span className="control-val-badge">{params.ksize} × {params.ksize}</span>
              </div>
              <input
                id="slider-gaussian-ksize"
                type="range"
                className="range-slider"
                min="3"
                max="151"
                step="2"
                value={params.ksize}
                onChange={(e) => updateParam('ksize', parseInt(e.target.value))}
              />
            </div>

            {/* Gaussian Sigma */}
            <div className="control-group">
              <div className="control-label-row">
                <span className="control-label">Gaussian Sigma (σ)</span>
                <span className="control-val-badge">{Number(params.sigma).toFixed(1)}</span>
              </div>
              <input
                id="slider-gaussian-sigma"
                type="range"
                className="range-slider"
                min="0.5"
                max="20.0"
                step="0.1"
                value={params.sigma}
                onChange={(e) => updateParam('sigma', parseFloat(e.target.value))}
              />
            </div>
          </>
        )}

        {/* Live 2D PSF Visualization Card */}
        <div className="psf-preview-card">
          <div className="psf-img-wrap">
            {psfPreview ? (
              <img src={psfPreview.psf_image} alt="PSF Kernel" />
            ) : (
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>...</span>
            )}
          </div>
          <div className="psf-details">
            <span className="psf-title">
              {psfPreview ? psfPreview.psf_name : 'Synthesizing PSF...'}
            </span>
            <span className="psf-meta">
              {psfPreview && `Grid: ${psfPreview.psf_shape[0]}×${psfPreview.psf_shape[1]} px | ∫h=1.0`}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Deconvolution Settings Section */}
      <div>
        <div className="section-header">
          <h2 className="section-title">
            <Sliders size={18} color="var(--accent-secondary)" />
            <span>Deconvolution Solver</span>
          </h2>
          <span className="section-badge">FFT Core</span>
        </div>

        {/* Algorithm Mode Switcher */}
        <div className="segmented-control" role="group" aria-label="Solver Mode">
          <button
            id="solver-mode-wiener"
            type="button"
            className={`segment-btn ${params.mode === 'wiener' ? 'active' : ''}`}
            onClick={() => updateParam('mode', 'wiener')}
          >
            <span>Wiener Filter</span>
          </button>
          <button
            id="solver-mode-inverse"
            type="button"
            className={`segment-btn ${params.mode === 'inverse' ? 'active' : ''}`}
            onClick={() => updateParam('mode', 'inverse')}
          >
            <span>Inverse Filter</span>
          </button>
        </div>

        {/* Wiener Regularization Factor K */}
        {params.mode === 'wiener' && (
          <div className="control-group">
            <div className="control-label-row">
              <span className="control-label" title="Regularization parameter representing noise-to-signal power ratio">
                Regularization Factor (K)
              </span>
              <span className="control-val-badge">{Number(params.K).toFixed(4)}</span>
            </div>
            <input
              id="slider-wiener-k"
              type="range"
              className="range-slider"
              min="0.0001"
              max="0.2"
              step="0.0001"
              value={params.K}
              onChange={(e) => updateParam('K', parseFloat(e.target.value))}
            />
          </div>
        )}

        {/* Edge Taper Alpha */}
        <div className="control-group">
          <div className="control-label-row">
            <span className="control-label" title="Cosine window edge tapering to mitigate border ringing in Fourier domain">
              Edge Taper Window (α)
            </span>
            <span className="control-val-badge">{Number(params.edgetaper_alpha).toFixed(2)}</span>
          </div>
          <input
            id="slider-edgetaper"
            type="range"
            className="range-slider"
            min="0.0"
            max="0.5"
            step="0.05"
            value={params.edgetaper_alpha}
            onChange={(e) => updateParam('edgetaper_alpha', parseFloat(e.target.value))}
          />
        </div>

        {/* Luma Only (Y-Channel) Toggle */}
        <div className="toggle-row">
          <div className="toggle-info">
            <span className="toggle-title">Luma-Only Processing</span>
            <span className="toggle-desc">Restore Y in YCrCb to suppress color noise</span>
          </div>
          <label className="switch">
            <input
              id="toggle-luma-only"
              type="checkbox"
              checked={params.luma_only}
              onChange={(e) => updateParam('luma_only', e.target.checked)}
            />
            <span className="slider-switch"></span>
          </label>
        </div>
      </div>

      {/* 3. Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          id="btn-run-deblur"
          type="button"
          className="action-btn-main"
          disabled={!hasImage || loading}
          onClick={onDeblur}
        >
          {loading ? (
            <>
              <div className="spinner" />
              <span>Deconvolving Image...</span>
            </>
          ) : (
            <>
              <Zap size={18} />
              <span>Deblur & Restore</span>
            </>
          )}
        </button>

        <button
          id="btn-reset-params"
          type="button"
          className="tool-btn"
          style={{ justifyContent: 'center', width: '100%', padding: '10px' }}
          onClick={onReset}
        >
          <RotateCcw size={14} />
          <span>Reset Defaults</span>
        </button>
      </div>
    </div>
  );
}
