import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

export default function SyncStatusBadge({ status }) {
  switch (status) {
    case 'synced':
      return (
        <span className="badge badge-synced" title="All changes saved to cloud">
          <CheckCircle2 size={12} />
          <span>Synced</span>
        </span>
      );

    case 'syncing':
      return (
        <span className="badge" style={{ background: 'var(--info-bg)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.3)' }} title="Synchronizing with server...">
          <RefreshCw size={12} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          <span>Syncing...</span>
        </span>
      );

    case 'pending_create':
    case 'pending_update':
    case 'pending_delete':
      return (
        <span className="badge badge-pending" title="Saved locally in IndexedDB. Will sync when online.">
          <Clock size={12} />
          <span>Offline Saved</span>
        </span>
      );

    case 'conflict':
      return (
        <span className="badge badge-conflict" title="Concurrent edits detected! Click to resolve.">
          <AlertTriangle size={12} />
          <span>Conflict!</span>
        </span>
      );

    default:
      return (
        <span className="badge badge-offline">
          <WifiOff size={12} />
          <span>Local</span>
        </span>
      );
  }
}
