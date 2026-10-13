import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import PresetsBar from './components/PresetsBar';
import ControlPanel from './components/ControlPanel';
import ComparisonViewport from './components/ComparisonViewport';
import SimulationPanel from './components/SimulationPanel';
import MetricsBanner from './components/MetricsBanner';
import TheoryGuide from './components/TheoryGuide';

export default function App() {
  const [activeTab, setActiveTab] = useState('restore'); // 'restore' | 'simulate' | 'theory'
  const [backendHealthy, setBackendHealthy] = useState(false);
  const [opencvVersion, setOpencvVersion] = useState('');
  const [samples, setSamples] = useState([]);
  const [activePresetId, setActivePresetId] = useState('');

  // Deblur parameters state
  const defaultParams = {
    psf_type: 'motion',
    length: 25,
    angle: 20.0,
    ksize: 21,
    sigma: 5.0,
    mode: 'wiener',
    K: 0.008,
    luma_only: true,
    edgetaper_alpha: 0.2,
    noise_sigma: 2.0
  };

  const [params, setParams] = useState(defaultParams);
  const [originalImage, setOriginalImage] = useState(null);
  const [restoredImage, setRestoredImage] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Check backend health and load pre-configured samples
  useEffect(() => {
    const initApp = async () => {
      try {
        const healthRes = await fetch('/api/health');
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setBackendHealthy(true);
          setOpencvVersion(healthData.opencv_version);
        }

        const samplesRes = await fetch('/api/samples');
        if (samplesRes.ok) {
          const samplesData = await samplesRes.json();
          setSamples(samplesData.samples || []);

          // Automatically select the first sample to immediately showcase working deblurring!
          if (samplesData.samples && samplesData.samples.length > 0) {
            handleSelectPreset(samplesData.samples[0]);
          }
        }
      } catch (err) {
        console.error('Backend connection check error:', err);
      }
    };

    initApp();
  }, []);

  // When user selects a preset
  const handleSelectPreset = async (sample) => {
    setActivePresetId(sample.id);
    setErrorMessage(null);

    // Apply recommended preset parameters
    const updatedParams = {
      ...params,
      psf_type: sample.psf_type || 'motion',
      length: sample.length || 21,
      angle: sample.angle !== undefined ? sample.angle : 0,
      ksize: sample.ksize || 21,
      sigma: sample.sigma || 5.0,
      mode: sample.mode || 'wiener',
      K: sample.K || 0.01,
      luma_only: sample.luma_only !== undefined ? sample.luma_only : true,
      edgetaper_alpha: sample.edgetaper_alpha || 0.2
    };
    setParams(updatedParams);

    // Fetch sample image file as base64
    try {
      setLoading(true);
      const imgRes = await fetch(`/samples/${sample.file}`);
      const blob = await imgRes.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result;
        setOriginalImage(base64Data);

        // Auto deblur the sample
        executeDeblurWithParams(base64Data, updatedParams);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Failed to load preset sample:', err);
      setLoading(false);
    }
  };

  // Upload custom user image
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActivePresetId('');
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      setOriginalImage(base64);
      setRestoredImage(null);
      setMetrics(null);
    };
    reader.readAsDataURL(file);
  };

  // Execute Deblurring with given parameters
  const executeDeblurWithParams = async (imgBase64, currentParams) => {
    if (!imgBase64) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/deblur-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imgBase64,
          psf_type: currentParams.psf_type,
          length: parseInt(currentParams.length),
          angle: parseFloat(currentParams.angle),
          ksize: parseInt(currentParams.ksize),
          sigma: parseFloat(currentParams.sigma),
          mode: currentParams.mode,
          K: parseFloat(currentParams.K),
          luma_only: Boolean(currentParams.luma_only),
          edgetaper_alpha: parseFloat(currentParams.edgetaper_alpha)
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Deconvolution failed');
      }

      const data = await res.json();
      setRestoredImage(data.restored_image);
      setMetrics(data.metrics);
    } catch (err) {
      console.error('Deblur error:', err);
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeblur = () => {
    executeDeblurWithParams(originalImage, params);
  };

  // Run Simulation Mode (Synthetic Blur + Noise + Restoration with Ground-truth PSNR)
  const handleSimulate = async () => {
    if (!originalImage) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/simulate-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: originalImage,
          psf_type: params.psf_type,
          length: parseInt(params.length),
          angle: parseFloat(params.angle),
          ksize: parseInt(params.ksize),
          sigma: parseFloat(params.sigma),
          noise_sigma: parseFloat(params.noise_sigma || 2.0),
          mode: params.mode,
          K: parseFloat(params.K),
          luma_only: Boolean(params.luma_only),
          edgetaper_alpha: parseFloat(params.edgetaper_alpha)
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Simulation failed');
      }

      const data = await res.json();
      // In simulation, original becomes the degraded image, and restored is the deblurred image
      setOriginalImage(data.blurred_image);
      setRestoredImage(data.restored_image);
      setMetrics(data.metrics);
    } catch (err) {
      console.error('Simulation error:', err);
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setParams(defaultParams);
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        backendHealthy={backendHealthy}
        opencvVersion={opencvVersion}
      />

      {/* Quick Presets Bar */}
      {activeTab !== 'theory' && (
        <PresetsBar
          samples={samples}
          onSelectPreset={handleSelectPreset}
          activePresetId={activePresetId}
        />
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.15)',
          border: '1px solid rgba(244, 63, 94, 0.4)',
          color: '#fecdd3',
          padding: '12px 18px',
          borderRadius: '12px',
          marginBottom: '20px',
          fontSize: '0.88rem'
        }}>
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Main Studio View */}
      {activeTab === 'restore' && (
        <>
          <main className="studio-grid">
            <ControlPanel
              params={params}
              setParams={setParams}
              onDeblur={handleDeblur}
              loading={loading}
              hasImage={Boolean(originalImage)}
              onReset={handleReset}
            />

            <ComparisonViewport
              originalImage={originalImage}
              restoredImage={restoredImage}
              metrics={metrics}
              onUpload={handleFileUpload}
              loading={loading}
            />
          </main>

          <MetricsBanner metrics={metrics} isSimulation={false} />
        </>
      )}

      {/* Simulation Lab View */}
      {activeTab === 'simulate' && (
        <>
          <main className="studio-grid">
            <SimulationPanel
              params={params}
              setParams={setParams}
              onRunSimulate={handleSimulate}
              loading={loading}
              hasImage={Boolean(originalImage)}
            />

            <ComparisonViewport
              originalImage={originalImage}
              restoredImage={restoredImage}
              metrics={metrics}
              onUpload={handleFileUpload}
              loading={loading}
            />
          </main>

          <MetricsBanner metrics={metrics} isSimulation={true} />
        </>
      )}

      {/* Fourier Theory & Math View */}
      {activeTab === 'theory' && (
        <TheoryGuide />
      )}
    </div>
  );
}
