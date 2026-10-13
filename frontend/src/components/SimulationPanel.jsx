import React from 'react';
import { Sparkles, Sliders, Volume2, Zap, RotateCcw } from 'lucide-react';

export default function SimulationPanel({
  params,
  setParams,
  onRunSimulate,
  loading,
  hasImage
}) {
  const updateParam = (key, val) => {
    setParams(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="control-panel">
      <div>
        <div className="section-header">
          <h2 className="section-title">
            <Sparkles size={18} color="var(--accent-secondary)" />
            <span>Blur & Noise Synthesis</span>
          </h2>
          <span className="section-badge">Simulator</span>
        </div>

        {/* Blur Model */}
        <div className="segmented-control" role="group" aria-label="Simulation PSF Type">
          <button
            type="button"
            className={`segment-btn ${params.psf_type === 'motion' ? 'active' : ''}`}
            onClick={() => updateParam('psf_type', 'motion')}
          >
            <span>Motion Blur</span>
          </button>
          <button
            type="button"
            className={`segment-btn ${params.psf_type === 'gaussian' ? 'active' : ''}`}
            onClick={() => updateParam('psf_type', 'gaussian')}
          >
            <span>Gaussian Blur</span>
          </button>
        </div>

        {params.psf_type === 'motion' ? (
          <>
            <div className="control-group">
              <div className="control-label-row">
                <span className="control-label">Motion Length</span>
                <span className="control-val-badge">{params.length} px</span>
              </div>
              <input
                type="range"
                className="range-slider"
                min="3"
                max="151"
                step="2"
                value={params.length}
                onChange={(e) => updateParam('length', parseInt(e.target.value))}
              />
            </div>

            <div className="control-group">
              <div className="control-label-row">
                <span className="control-label">Motion Angle</span>
                <span className="control-val-badge">{params.angle}°</span>
              </div>
              <input
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
            <div className="control-group">
              <div className="control-label-row">
                <span className="control-label">Kernel Size</span>
                <span className="control-val-badge">{params.ksize} × {params.ksize}</span>
              </div>
              <input
                type="range"
                className="range-slider"
                min="3"
                max="151"
                step="2"
                value={params.ksize}
                onChange={(e) => updateParam('ksize', parseInt(e.target.value))}
              />
            </div>

            <div className="control-group">
              <div className="control-label-row">
                <span className="control-label">Gaussian Sigma (σ)</span>
                <span className="control-val-badge">{Number(params.sigma).toFixed(1)}</span>
              </div>
              <input
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

        {/* Additive Gaussian Noise */}
        <div className="control-group">
          <div className="control-label-row">
            <span className="control-label">Synthetic Noise (σ_noise)</span>
            <span className="control-val-badge">{Number(params.noise_sigma || 2.0).toFixed(1)}</span>
          </div>
          <input
            type="range"
            className="range-slider"
            min="0.0"
            max="20.0"
            step="0.5"
            value={params.noise_sigma || 2.0}
            onChange={(e) => updateParam('noise_sigma', parseFloat(e.target.value))}
          />
        </div>
      </div>

      {/* Restoration Solver */}
      <div>
        <div className="section-header">
          <h2 className="section-title">
            <Sliders size={18} color="var(--accent-primary)" />
            <span>Restoration Solver</span>
          </h2>
          <span className="section-badge">Wiener / Inverse</span>
        </div>

        <div className="segmented-control" role="group">
          <button
            type="button"
            className={`segment-btn ${params.mode === 'wiener' ? 'active' : ''}`}
            onClick={() => updateParam('mode', 'wiener')}
          >
            <span>Wiener Filter</span>
          </button>
          <button
            type="button"
            className={`segment-btn ${params.mode === 'inverse' ? 'active' : ''}`}
            onClick={() => updateParam('mode', 'inverse')}
          >
            <span>Inverse Filter</span>
          </button>
        </div>

        {params.mode === 'wiener' && (
          <div className="control-group">
            <div className="control-label-row">
              <span className="control-label">Wiener Regularization (K)</span>
              <span className="control-val-badge">{Number(params.K).toFixed(4)}</span>
            </div>
            <input
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

        <div className="toggle-row">
          <div className="toggle-info">
            <span className="toggle-title">Luma-Only Channel</span>
            <span className="toggle-desc">Protect chrominance channels</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={params.luma_only}
              onChange={(e) => updateParam('luma_only', e.target.checked)}
            />
            <span className="slider-switch"></span>
          </label>
        </div>
      </div>

      <button
        id="btn-run-simulation"
        type="button"
        className="action-btn-main"
        disabled={!hasImage || loading}
        onClick={onRunSimulate}
      >
        {loading ? (
          <>
            <div className="spinner" />
            <span>Simulating Degradation & Deconvolving...</span>
          </>
        ) : (
          <>
            <Zap size={18} />
            <span>Simulate & Restore</span>
          </>
        )}
      </button>
    </div>
  );
}
