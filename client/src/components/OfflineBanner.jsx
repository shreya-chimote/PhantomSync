import React from 'react';
import { WifiOff, CloudUpload } from 'lucide-react';

export default function OfflineBanner({ isOnline, isSimulated, pendingCount, onToggleSimulated }) {
  if (isOnline) return null;

  return (
    <div
      style={{
        backgroundColor: '#78350f',
        color: '#fef3c7',
        padding: '8px 16px',
        fontSize: '0.875rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #b45309',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <WifiOff size={16} />
        <span>
          <strong>Offline Mode Active</strong> {isSimulated ? '(Simulated via toggle)' : '(No network connection)'} — All edits are saved locally in <strong>IndexedDB</strong>.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {pendingCount > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
            <CloudUpload size={14} />
            <span>{pendingCount} change{pendingCount > 1 ? 's' : ''} queued</span>
          </span>
        )}

        {isSimulated && (
          <button
            onClick={onToggleSimulated}
            style={{
              background: '#fef3c7',
              color: '#78350f',
              padding: '3px 10px',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            Go Online
          </button>
        )}
      </div>
    </div>
  );
}
