import React, { useState, useEffect, useRef } from 'react';
import { History, AlertTriangle, Tag, Check, Sparkles, Clock } from 'lucide-react';
import SyncStatusBadge from './SyncStatusBadge.jsx';

export default function NoteEditor({
  note,
  onUpdateNote,
  onOpenHistory,
  onOpenConflict,
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [isSaved, setIsSaved] = useState(true);

  const debounceTimerRef = useRef(null);

  // Sync internal state when note selection changes
  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setTags(note.tags || []);
      setIsSaved(true);
    }
  }, [note?._id]);

  if (!note) {
    return (
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-dim)',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <Sparkles size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          No note selected
        </h2>
        <p style={{ fontSize: '0.875rem', marginTop: '4px' }}>
          Select a note from the sidebar or click "New Note" to create one.
        </p>
      </main>
    );
  }

  const triggerAutoSave = (newTitle, newContent, newTags) => {
    setIsSaved(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      await onUpdateNote(note._id, {
        title: newTitle,
        content: newContent,
        tags: newTags,
      });
      setIsSaved(true);
    }, 400); // 400ms debounce
  };

  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitle(val);
    triggerAutoSave(val, content, tags);
  };

  const handleContentChange = (e) => {
    const val = e.target.value;
    setContent(val);
    triggerAutoSave(title, val, tags);
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const trimmed = tagInput.trim().toLowerCase();
      if (!tags.includes(trimmed)) {
        const nextTags = [...tags, trimmed];
        setTags(nextTags);
        triggerAutoSave(title, content, nextTags);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    const nextTags = tags.filter((t) => t !== tagToRemove);
    setTags(nextTags);
    triggerAutoSave(title, content, nextTags);
  };

  const hasConflict = note.syncStatus === 'conflict';

  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)',
        height: 'calc(100vh - 65px)',
        overflow: 'hidden',
      }}
    >
      {/* Conflict Alert Banner if note is in conflict */}
      {hasConflict && (
        <div
          style={{
            backgroundColor: 'var(--danger-bg)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f87171' }}>
            <AlertTriangle size={18} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              Conflict Detected! Another user or session edited this note concurrently on the server.
            </span>
          </div>

          <button
            onClick={() => onOpenConflict(note)}
            className="btn-primary"
            style={{ backgroundColor: 'var(--danger)', fontSize: '0.8rem', padding: '6px 14px' }}
          >
            Review & Resolve Conflict
          </button>
        </div>
      )}

      {/* Editor Top Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SyncStatusBadge status={note.syncStatus} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            Revision v{note.version || 1}
          </span>
          <span style={{ fontSize: '0.75rem', color: isSaved ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isSaved ? <Check size={12} /> : <Clock size={12} />}
            {isSaved ? 'Saved to IndexedDB' : 'Saving...'}
          </span>
        </div>

        {/* Toolbar Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => onOpenHistory(note._id)}
            className="btn-secondary"
            title="View revision snapshots and restore earlier versions"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <History size={15} />
            <span>Version History</span>
          </button>
        </div>
      </div>

      {/* Title Input */}
      <div style={{ padding: '20px 24px 0' }}>
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Note title..."
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            outline: 'none',
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            letterSpacing: '-0.02em',
          }}
        />
      </div>

      {/* Tags Chips Bar */}
      <div style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <Tag size={14} color="var(--text-dim)" />
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            #{tag}
            <button
              onClick={() => handleRemoveTag(tag)}
              style={{ color: 'var(--text-dim)', fontSize: '0.8rem', lineHeight: 1 }}
            >
              &times;
            </button>
          </span>
        ))}

        <input
          type="text"
          placeholder="Add tag + Enter..."
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleAddTag}
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            width: '120px',
          }}
        />
      </div>

      {/* Content Textarea */}
      <div style={{ flex: 1, padding: '12px 24px 24px', display: 'flex', flexDirection: 'column' }}>
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Type your notes here... (All edits are saved offline in IndexedDB and synchronized automatically when online)"
          style={{
            flex: 1,
            width: '100%',
            background: 'none',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontSize: '1rem',
            lineHeight: 1.6,
            color: 'var(--text-main)',
            fontFamily: 'var(--font-sans)',
          }}
        />
      </div>

      {/* Bottom Status bar */}
      <div
        style={{
          padding: '8px 24px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '0.75rem',
          color: 'var(--text-dim)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>
          {content.length} characters &bull; {content.trim() ? content.trim().split(/\s+/).length : 0} words
        </span>
        <span>Offline-ready &bull; OCC base version: v{note.baseVersion !== undefined ? note.baseVersion : note.version}</span>
      </div>
    </main>
  );
}
