import React, { useState } from 'react';
import { Search, FileText, Trash2, AlertCircle } from 'lucide-react';
import SyncStatusBadge from './SyncStatusBadge.jsx';

export default function NoteList({
  notes = [],
  activeNoteId,
  onSelectNote,
  onDeleteNote,
  onOpenConflictModal,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'conflicts' | 'pending'

  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'conflicts') {
      return note.syncStatus === 'conflict';
    }
    if (filter === 'pending') {
      return note.syncStatus && note.syncStatus.startsWith('pending');
    }
    return true;
  });

  return (
    <aside
      style={{
        width: '320px',
        borderRight: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 65px)',
      }}
    >
      {/* Search Bar */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--bg-primary)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          <Search size={16} color="var(--text-dim)" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              width: '100%',
              fontSize: '0.875rem',
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          {['all', 'conflicts', 'pending'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                fontSize: '0.75rem',
                textTransform: 'capitalize',
                padding: '4px 10px',
                borderRadius: '6px',
                background: filter === tab ? 'var(--primary)' : 'var(--bg-tertiary)',
                color: filter === tab ? '#fff' : 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              {tab === 'conflicts' ? `Conflicts (${notes.filter((n) => n.syncStatus === 'conflict').length})` : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Notes Cards List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {filteredNotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-dim)' }}>
            <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <p style={{ fontSize: '0.875rem' }}>No notes found</p>
          </div>
        ) : (
          filteredNotes.map((note) => {
            const isActive = note._id === activeNoteId;
            const isConflict = note.syncStatus === 'conflict';

            return (
              <div
                key={note._id}
                onClick={() => onSelectNote(note._id)}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  backgroundColor: isActive ? 'var(--bg-tertiary)' : 'var(--bg-card)',
                  border: isConflict
                    ? '1px solid var(--danger)'
                    : isActive
                    ? '1px solid var(--border-focus)'
                    : '1px solid var(--border-color)',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <h3
                    style={{
                      fontSize: '0.925rem',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '180px',
                    }}
                  >
                    {note.title || 'Untitled Note'}
                  </h3>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this note?')) {
                        onDeleteNote(note._id);
                      }
                    }}
                    title="Delete Note"
                    style={{ color: 'var(--text-dim)', padding: '2px', borderRadius: '4px' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    margin: '6px 0 10px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: 1.4,
                  }}
                >
                  {note.content ? note.content.slice(0, 100) : 'No content yet...'}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <SyncStatusBadge status={note.syncStatus} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    v{note.version || 1}
                  </span>
                </div>

                {/* Conflict Banner Action */}
                {isConflict && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenConflictModal(note);
                    }}
                    style={{
                      marginTop: '8px',
                      width: '100%',
                      background: 'var(--danger-bg)',
                      color: '#f87171',
                      border: '1px solid rgba(239,68,68,0.4)',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <AlertCircle size={14} />
                    <span>Resolve Conflict</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
