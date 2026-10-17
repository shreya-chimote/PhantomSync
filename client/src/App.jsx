import React, { useState } from 'react';
import Navbar from './components/Navbar.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import NoteList from './components/NoteList.jsx';
import NoteEditor from './components/NoteEditor.jsx';
import ConflictResolverModal from './components/ConflictResolverModal.jsx';
import VersionHistoryModal from './components/VersionHistoryModal.jsx';
import { useNotes } from './hooks/useNotes.js';

export default function App() {
  const {
    notes,
    activeNote,
    activeNoteId,
    setActiveNoteId,
    isOnline,
    isSyncing,
    pendingCount,
    conflictNote,
    setConflictNote,
    createNewNote,
    updateCurrentNote,
    deleteCurrentNote,
    manualSync,
    toggleSimulatedOffline,
    isSimulatedOffline,
    resolveConflict,
    refresh,
  } = useNotes();

  const [historyNoteId, setHistoryNoteId] = useState(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Top Navbar */}
      <Navbar
        isOnline={isOnline}
        isSimulatedOffline={isSimulatedOffline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
        onToggleSimulated={toggleSimulatedOffline}
        onManualSync={manualSync}
        onCreateNote={createNewNote}
      />

      {/* Offline Status Alert Banner */}
      <OfflineBanner
        isOnline={isOnline}
        isSimulated={isSimulatedOffline}
        pendingCount={pendingCount}
        onToggleSimulated={toggleSimulatedOffline}
      />

      {/* Main Workspace (Sidebar + Editor) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <NoteList
          notes={notes}
          activeNoteId={activeNoteId}
          onSelectNote={setActiveNoteId}
          onDeleteNote={deleteCurrentNote}
          onOpenConflictModal={(note) => setConflictNote(note)}
        />

        <NoteEditor
          note={activeNote}
          onUpdateNote={updateCurrentNote}
          onOpenHistory={(id) => setHistoryNoteId(id)}
          onOpenConflict={(note) => setConflictNote(note)}
        />
      </div>

      {/* Conflict Resolution Modal (Side-by-side OCC reconciliation) */}
      {conflictNote && (
        <ConflictResolverModal
          conflictNote={conflictNote}
          onResolve={resolveConflict}
          onClose={() => setConflictNote(null)}
        />
      )}

      {/* Version History Modal */}
      {historyNoteId && (
        <VersionHistoryModal
          noteId={historyNoteId}
          currentVersion={notes.find((n) => n._id === historyNoteId)?.version || 1}
          onClose={() => setHistoryNoteId(null)}
          onVersionRestored={async () => {
            await refresh();
          }}
        />
      )}
    </div>
  );
}
