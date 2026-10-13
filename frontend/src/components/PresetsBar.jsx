import React from 'react';
import { Bookmark, Camera, MapPin, Sparkles } from 'lucide-react';

export default function PresetsBar({ samples, onSelectPreset, activePresetId }) {
  const getIcon = (id) => {
    if (id.includes('street')) return <MapPin size={14} />;
    if (id.includes('sharp')) return <Sparkles size={14} />;
    return <Camera size={14} />;
  };

  return (
    <div className="presets-bar">
      <div className="presets-label">
        <Bookmark size={14} color="var(--accent-primary)" />
        <span>Quick Presets:</span>
      </div>

      {samples && samples.map((sample) => (
        <button
          key={sample.id}
          id={`preset-${sample.id}`}
          className={`preset-chip ${activePresetId === sample.id ? 'active' : ''}`}
          onClick={() => onSelectPreset(sample)}
          title={sample.description}
        >
          {getIcon(sample.id)}
          <span>{sample.title}</span>
        </button>
      ))}
    </div>
  );
}
