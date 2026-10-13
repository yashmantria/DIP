import React, { useState, useRef, useEffect } from 'react';
import { 
  Columns, 
  SplitSquareVertical, 
  Download, 
  Upload, 
  Image as ImageIcon,
  Sparkles,
  Maximize2
} from 'lucide-react';

export default function ComparisonViewport({
  originalImage,
  restoredImage,
  metrics,
  onUpload,
  loading
}) {
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'side-by-side'
  const [sliderPos, setSliderPos] = useState(50); // percentage 0-100
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [originalImage, viewMode]);

  // Mouse / Touch drag handlers for interactive split comparison slider
  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  };

  const handleMouseDown = () => setIsDragging(true);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e) => {
      if (isDragging) handleMove(e.clientX);
    };
    const handleTouchMove = (e) => {
      if (isDragging && e.touches[0]) handleMove(e.touches[0].clientX);
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isDragging]);

  const handleDownload = () => {
    if (!restoredImage) return;
    const link = document.createElement('a');
    link.href = restoredImage;
    link.download = `restored_opencv_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="workspace-area">
      {/* Workspace Toolbar */}
      <div className="workspace-toolbar">
        <div className="view-mode-tabs" role="tablist" aria-label="Viewer Mode">
          <button
            id="view-mode-split"
            className={`view-tab ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => setViewMode('split')}
          >
            <SplitSquareVertical size={14} />
            <span>Split Slider</span>
          </button>
          <button
            id="view-mode-side"
            className={`view-tab ${viewMode === 'side-by-side' ? 'active' : ''}`}
            onClick={() => setViewMode('side-by-side')}
          >
            <Columns size={14} />
            <span>Side-by-Side</span>
          </button>
        </div>

        <div className="toolbar-actions">
          <button
            id="btn-upload-new"
            className="tool-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} />
            <span>Upload New</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="file-input-hidden"
            onChange={onUpload}
          />

          <button
            id="btn-download-image"
            className="tool-btn primary"
            disabled={!restoredImage}
            onClick={handleDownload}
          >
            <Download size={14} />
            <span>Export Restored PNG</span>
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="viewport-card">
        {!originalImage ? (
          <div 
            className="dropzone-container"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="dropzone-icon">
              <Upload size={28} />
            </div>
            <h3 className="dropzone-title">Upload a Blurry Image to Restore</h3>
            <p className="dropzone-sub">
              Drag and drop PNG, JPG, or TIFF, or click quick presets above.
            </p>
          </div>
        ) : viewMode === 'split' ? (
          <div 
            className="split-slider-container"
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
          >
            {/* Background layer: Restored image (shown on the right side) */}
            <div className="split-layer">
              <img 
                src={restoredImage || originalImage} 
                alt="Restored output" 
              />
              <span className="split-badge badge-right">Restored (OpenCV)</span>
            </div>

            {/* Foreground overlay: Original blurred image (clipped to slider width) */}
            <div 
              className="split-layer-overlay"
              style={{ width: `${sliderPos}%` }}
            >
              <img 
                src={originalImage} 
                alt="Original blurry input"
                style={{ 
                  width: containerWidth ? `${containerWidth}px` : '100%' 
                }}
              />
              <span className="split-badge badge-left">Original Blurred</span>
            </div>

            {/* Drag Handle Divider */}
            <div 
              className="split-handle"
              style={{ left: `${sliderPos}%` }}
            >
              <SplitSquareVertical size={16} />
            </div>
          </div>
        ) : (
          <div className="side-by-side-grid">
            <div className="image-card">
              <div className="image-card-header">
                <span>Input (Blurred)</span>
                {metrics && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    Laplacian Var: {metrics.original_sharpness}
                  </span>
                )}
              </div>
              <div className="image-card-body">
                <img src={originalImage} alt="Input Blurred" />
              </div>
            </div>

            <div className="image-card">
              <div className="image-card-header">
                <span style={{ color: '#818cf8' }}>Restored (Deconvolution)</span>
                {metrics && (
                  <span style={{ color: 'var(--accent-emerald)' }}>
                    Laplacian Var: {metrics.restored_sharpness}
                  </span>
                )}
              </div>
              <div className="image-card-body">
                <img src={restoredImage || originalImage} alt="Restored" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
