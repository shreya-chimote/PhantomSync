import React from 'react';
import { Sparkles, RefreshCw, Wifi, WifiOff, Plus, Layers } from 'lucide-react';

export default function Navbar({
  isOnline,
  isSimulatedOffline,
  isSyncing,
  pendingCount,
  onToggleSimulated,
  onManualSync,
  onCreateNote,
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            padding: '8px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
          }}
        >
          <Sparkles size={20} color="#fff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>PhantomSync AI</h1>
            <span
              style={{
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#a5b4fc',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 700,
              }}
            >
              Offline-First
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            IndexedDB Local Storage &bull; Vector OCC &bull; AI Merge Engine
          </p>
        </div>
      </div>

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Network Simulator Toggle */}
        <button
          onClick={onToggleSimulated}
          title="Toggle network simulation to test offline functionality"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600,
            background: isOnline ? 'var(--success-bg)' : 'var(--danger-bg)',
            color: isOnline ? '#34d399' : '#f87171',
            border: isOnline ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
          }}
        >
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{isOnline ? 'Online' : 'Offline (Simulated)'}</span>
        </button>

        {/* Sync Now button */}
        <button
          onClick={onManualSync}
          disabled={!isOnline || isSyncing}
          className="btn-secondary"
          title="Force synchronization with server"
          style={{ opacity: !isOnline ? 0.5 : 1, position: 'relative' }}
        >
          <RefreshCw size={15} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
          <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          {pendingCount > 0 && (
            <span
              style={{
                background: 'var(--warning)',
                color: '#000',
                fontSize: '0.65rem',
                fontWeight: 700,
                borderRadius: '9999px',
                padding: '1px 6px',
                marginLeft: '4px',
              }}
            >
              {pendingCount}
            </span>
          )}
        </button>

        {/* Create Note */}
        <button onClick={onCreateNote} className="btn-primary">
          <Plus size={16} />
          <span>New Note</span>
        </button>
      </div>
    </header>
  );
}
