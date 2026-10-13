import React from 'react';
import { Sparkles, Sliders, Activity, BookOpen, Layers } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, backendHealthy, opencvVersion }) {
  return (
    <header className="studio-header">
      <div className="brand-wrapper">
        <div className="brand-logo-icon">
          <Layers size={24} />
        </div>
        <div>
          <h1 className="brand-title">
            VisionDeblur Studio
            <span className="brand-badge">OpenCV 5.0</span>
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Fourier Deconvolution & Optical Point Spread Function Restoration
          </p>
        </div>
      </div>

      <nav className="nav-tabs" aria-label="Main Navigation">
        <button
          id="nav-tab-restore"
          className={`nav-tab-btn ${activeTab === 'restore' ? 'active' : ''}`}
          onClick={() => setActiveTab('restore')}
        >
          <Sliders size={16} />
          <span>Restore Studio</span>
        </button>

        <button
          id="nav-tab-simulate"
          className={`nav-tab-btn ${activeTab === 'simulate' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulate')}
        >
          <Sparkles size={16} />
          <span>Simulation Lab</span>
        </button>

        <button
          id="nav-tab-theory"
          className={`nav-tab-btn ${activeTab === 'theory' ? 'active' : ''}`}
          onClick={() => setActiveTab('theory')}
        >
          <BookOpen size={16} />
          <span>Fourier Theory & Math</span>
        </button>
      </nav>

      <div className="header-status">
        <div className="status-indicator">
          <span className={`status-dot ${backendHealthy ? '' : 'offline'}`} />
          <span>{backendHealthy ? `FastAPI Online (${opencvVersion || 'CV2'})` : 'Connecting...'}</span>
        </div>
      </div>
    </header>
  );
}
