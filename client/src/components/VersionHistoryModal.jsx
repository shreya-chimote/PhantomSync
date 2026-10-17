import React, { useState, useEffect } from 'react';
import { History, RotateCcw, Clock, X, Check, FileText } from 'lucide-react';
import { api } from '../services/api.js';

export default function VersionHistoryModal({
  noteId,
  currentVersion,
  onClose,
  onVersionRestored,
}) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoringVersion, setRestoringVersion] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getHistory(noteId);
        if (res.ok) {
          setHistory(res.data.history || []);
        } else {
          setError(res.data.error || 'Failed to load history');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (noteId) {
      loadHistory();
    }
  }, [noteId]);

  const handleRestore = async (version) => {
    if (!confirm(`Restore note to revision v${version}? This will create a new current revision with this historical content.`)) {
      return;
    }

    setRestoringVersion(version);
    try {
      const res = await api.restoreVersion(noteId, version, 'client-web');
      if (res.ok) {
        onVersionRestored(res.data.note);
        onClose();
      } else {
        alert('Failed to restore version: ' + (res.data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error restoring version: ' + err.message);
    } finally {
      setRestoringVersion(null);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '750px' }}>
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'var(--info-bg)', padding: '6px', borderRadius: '8px', color: '#38bdf8' }}>
              <History size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Version History & Time Travel</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Immutable snapshots of every revision saved to the server.
              </p>
            </div>
          </div>

          <button onClick={onClose} style={{ color: 'var(--text-dim)', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Snapshots List */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', maxHeight: '65vh' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
              Loading revision history...
            </div>
          ) : error ? (
            <div style={{ color: '#f87171', padding: '20px', textAlign: 'center' }}>{error}</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
              <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p>No revision snapshots found on server yet.</p>
              <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                Revisions are created when the note synchronizes with the server.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {history.map((snapshot) => {
                const isCurrent = snapshot.version === currentVersion;

                return (
                  <div
                    key={snapshot._id || snapshot.version}
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: isCurrent ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            color: isCurrent ? 'var(--primary)' : 'var(--text-main)',
                            backgroundColor: 'var(--bg-secondary)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          v{snapshot.version}
                        </span>

                        <span
                          style={{
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor:
                              snapshot.changeType === 'create'
                                ? 'var(--success-bg)'
                                : snapshot.changeType === 'conflict_resolved'
                                ? 'var(--warning-bg)'
                                : 'var(--info-bg)',
                            color:
                              snapshot.changeType === 'create'
                                ? '#34d399'
                                : snapshot.changeType === 'conflict_resolved'
                                ? '#fbbf24'
                                : '#38bdf8',
                          }}
                        >
                          {snapshot.changeType}
                        </span>

                        {isCurrent && (
                          <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 600 }}>
                            (Current Version)
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          {new Date(snapshot.savedAt || snapshot.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>

                        {!isCurrent && (
                          <button
                            onClick={() => handleRestore(snapshot.version)}
                            disabled={restoringVersion === snapshot.version}
                            className="btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          >
                            <RotateCcw size={12} />
                            <span>{restoringVersion === snapshot.version ? 'Restoring...' : 'Restore'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                      {snapshot.title || 'Untitled Note'}
                    </div>

                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--bg-secondary)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '80px',
                        overflowY: 'auto',
                        lineHeight: 1.4,
                      }}
                    >
                      {snapshot.content || <em>Empty note content</em>}
                    </div>

                    {snapshot.summary && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                        Summary: {snapshot.summary}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <button onClick={onClose} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
