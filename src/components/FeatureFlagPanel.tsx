/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                      FEATURE FLAG CONTROL PANEL                           ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  UI component for runtime feature flag management.                        ║
 * ║  Allows developers to toggle features without code changes.               ║
 * ║                                                                            ║
 * ║  TO SHOW/HIDE THIS PANEL:                                                ║
 * ║  ---------------------------                                              ║
 * ║  1. Press Ctrl+Shift+F (or Cmd+Shift+F on Mac)                           ║
 * ║  2. Or set REACT_APP_SHOW_FEATURE_PANEL=true in .env                    ║
 * ║                                                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { FeatureFlags } from '../config/featureFlags';

interface FeatureFlagPanelProps {
  defaultOpen?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export const FeatureFlagPanel: React.FC<FeatureFlagPanelProps> = ({
  defaultOpen = false,
  position = 'bottom-right',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<'flags' | 'presets' | 'export'>('flags');
  const [exportedJson, setExportedJson] = useState('');
  const [importJson, setImportJson] = useState('');
  
  const {
    flags,
    toggleFlag,
    updateFlag,
    reset,
    applyPreset,
    exportConfig,
    importConfig,
    availableCaptureMethods,
  } = useFeatureFlags();
  
  // Keyboard shortcut to toggle panel
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);
  
  // Group feature flags by category
  const flagGroups = {
    'Master Controls': [
      'ENABLE_BROWSER_CAPTURE',
      'ENABLE_SYSTEM_AUDIO',
    ],
    'Browser Support': [
      'ENABLE_CHROME_EXTENSION',
      'ENABLE_SAFARI_CAPTURE',
      'ENABLE_FIREFOX_CAPTURE',
    ],
    'UI Features': [
      'ENABLE_AUDIO_SOURCE_SELECTOR',
      'ENABLE_CROSS_BROWSER_UI',
      'ENABLE_AUDIO_VISUALIZER',
      'ENABLE_PERMISSION_PROMPTS',
    ],
    'Advanced': [
      'ENABLE_AUTO_SOURCE_FALLBACK',
      'ENABLE_QUALITY_ADAPTATION',
      'ENABLE_DEBUG_MODE',
      'ENABLE_TELEMETRY',
    ],
  };
  
  const handleExport = useCallback(() => {
    const json = exportConfig();
    setExportedJson(json);
    navigator.clipboard.writeText(json);
  }, [exportConfig]);
  
  const handleImport = useCallback(() => {
    if (importConfig(importJson)) {
      setImportJson('');
      alert('Configuration imported successfully!');
    } else {
      alert('Failed to import configuration. Check the JSON format.');
    }
  }, [importConfig, importJson]);
  
  // Don't render in production unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && 
      process.env.REACT_APP_SHOW_FEATURE_PANEL !== 'true') {
    return null;
  }
  
  const positionStyles = {
    'top-right': { top: 20, right: 20 },
    'top-left': { top: 20, left: 20 },
    'bottom-right': { bottom: 20, right: 20 },
    'bottom-left': { bottom: 20, left: 20 },
  };
  
  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          ...positionStyles[position],
          zIndex: 10000,
          padding: '8px 12px',
          backgroundColor: '#4a5568',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
        title="Toggle Feature Flags (Ctrl+Shift+F)"
      >
        ⚙️ Features
      </button>
      
      {/* Main Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            ...positionStyles[position],
            transform: position.includes('right') ? 'translateX(-60px)' : 'translateX(60px)',
            zIndex: 9999,
            width: '400px',
            maxHeight: '600px',
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#2d3748',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Feature Flags</h3>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
          
          {/* Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f7fafc',
          }}>
            {(['flags', 'presets', 'export'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  backgroundColor: activeTab === tab ? 'white' : 'transparent',
                  borderBottom: activeTab === tab ? '2px solid #4299e1' : 'none',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          
          {/* Content */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px',
          }}>
            {/* Flags Tab */}
            {activeTab === 'flags' && (
              <div>
                {Object.entries(flagGroups).map(([group, groupFlags]) => (
                  <div key={group} style={{ marginBottom: '20px' }}>
                    <h4 style={{
                      fontSize: '14px',
                      fontWeight: 'bold',
                      marginBottom: '8px',
                      color: '#4a5568',
                    }}>
                      {group}
                    </h4>
                    {groupFlags.map(flag => (
                      <label
                        key={flag}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px',
                          backgroundColor: '#f7fafc',
                          marginBottom: '4px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{
                          fontSize: '13px',
                          color: flags[flag as keyof FeatureFlags] ? '#2b6cb0' : '#718096',
                        }}>
                          {flag.replace(/_/g, ' ').toLowerCase()}
                        </span>
                        <input
                          type="checkbox"
                          checked={flags[flag as keyof FeatureFlags]}
                          onChange={() => toggleFlag(flag as keyof FeatureFlags)}
                          style={{ cursor: 'pointer' }}
                        />
                      </label>
                    ))}
                  </div>
                ))}
                
                <div style={{
                  marginTop: '20px',
                  padding: '12px',
                  backgroundColor: '#edf2f7',
                  borderRadius: '4px',
                }}>
                  <p style={{ fontSize: '12px', margin: '0 0 8px 0', color: '#4a5568' }}>
                    Available capture methods:
                  </p>
                  <div style={{ fontSize: '11px', color: '#718096' }}>
                    {availableCaptureMethods.join(', ')}
                  </div>
                </div>
              </div>
            )}
            
            {/* Presets Tab */}
            {activeTab === 'presets' && (
              <div>
                <p style={{ fontSize: '13px', marginBottom: '16px', color: '#718096' }}>
                  Quick configuration presets for different environments:
                </p>
                {[
                  { name: 'production', desc: 'All features enabled, no debug' },
                  { name: 'development', desc: 'Debug enabled, telemetry off' },
                  { name: 'testing', desc: 'Minimal features for testing' },
                  { name: 'minimal', desc: 'Microphone only, no browser capture' },
                ].map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset.name as any)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      marginBottom: '8px',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {preset.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096' }}>
                      {preset.desc}
                    </div>
                  </button>
                ))}
                
                <button
                  onClick={reset}
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '16px',
                    backgroundColor: '#e53e3e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Reset to Defaults
                </button>
              </div>
            )}
            
            {/* Export Tab */}
            {activeTab === 'export' && (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Export Configuration</h4>
                  <button
                    onClick={handleExport}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#48bb78',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginBottom: '8px',
                    }}
                  >
                    Copy to Clipboard
                  </button>
                  {exportedJson && (
                    <textarea
                      value={exportedJson}
                      readOnly
                      style={{
                        width: '100%',
                        height: '120px',
                        padding: '8px',
                        border: '1px solid #cbd5e0',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                    />
                  )}
                </div>
                
                <div>
                  <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Import Configuration</h4>
                  <textarea
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                    placeholder="Paste JSON configuration here..."
                    style={{
                      width: '100%',
                      height: '120px',
                      padding: '8px',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      marginBottom: '8px',
                    }}
                  />
                  <button
                    onClick={handleImport}
                    disabled={!importJson}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: importJson ? '#4299e1' : '#cbd5e0',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: importJson ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Import
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};