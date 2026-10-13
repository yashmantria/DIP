import React from 'react';
import { Clock, Cpu, BarChart2, CheckCircle2, TrendingUp } from 'lucide-react';

export default function MetricsBanner({ metrics, isSimulation }) {
  if (!metrics) return null;

  return (
    <div className="metrics-banner">
      <div className="metric-item">
        <span className="metric-label">Execution Latency</span>
        <div className="metric-value indigo">
          <Clock size={16} />
          <span>{metrics.execution_time_ms} ms</span>
        </div>
      </div>

      <div className="metric-item">
        <span className="metric-label">Resolution</span>
        <div className="metric-value">
          <Cpu size={16} color="var(--text-secondary)" />
          <span>{metrics.width} × {metrics.height} px</span>
        </div>
      </div>

      {isSimulation ? (
        <>
          <div className="metric-item">
            <span className="metric-label">Blurred PSNR</span>
            <div className="metric-value" style={{ color: '#f59e0b' }}>
              <span>{metrics.psnr_blurred_db} dB</span>
            </div>
          </div>

          <div className="metric-item">
            <span className="metric-label">Restored PSNR</span>
            <div className="metric-value highlight">
              <CheckCircle2 size={16} />
              <span>{metrics.psnr_restored_db} dB</span>
            </div>
          </div>

          <div className="metric-item">
            <span className="metric-label">PSNR Gain</span>
            <div className="metric-value cyan">
              <TrendingUp size={16} />
              <span>+{metrics.psnr_gain_db} dB</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="metric-item">
            <span className="metric-label">Original Sharpness (∇² Var)</span>
            <div className="metric-value">
              <span>{metrics.original_sharpness}</span>
            </div>
          </div>

          <div className="metric-item">
            <span className="metric-label">Restored Sharpness</span>
            <div className="metric-value highlight">
              <CheckCircle2 size={16} />
              <span>{metrics.restored_sharpness}</span>
            </div>
          </div>

          <div className="metric-item">
            <span className="metric-label">Sharpness Improvement</span>
            <div className="metric-value cyan">
              <TrendingUp size={16} />
              <span>{metrics.sharpness_gain_pct > 0 ? `+${metrics.sharpness_gain_pct}%` : `${metrics.sharpness_gain_pct}%`}</span>
            </div>
          </div>
        </>
      )}

      <div className="metric-item">
        <span className="metric-label">Active Filter Model</span>
        <div className="metric-value" style={{ fontSize: '0.95rem' }}>
          <span>{metrics.mode} {metrics.regularization_K ? `(K=${metrics.regularization_K})` : ''}</span>
        </div>
      </div>
    </div>
  );
}
