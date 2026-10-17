import { useState, useEffect, useCallback } from 'react';
import { getLocalNotes, getLocalNoteById, getPendingSyncQueue } from '../db/indexedDb.js';
import { syncManager } from '../services/syncManager.js';

export function useNotes() {
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(syncManager.isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictNote, setConflictNote] = useState(null); // active note undergoing conflict resolution

  // Refresh notes and pending queue count from IndexedDB
  const refresh = useCallback(async () => {
    try {
      const localNotes = await getLocalNotes();
      // Sort by updatedAt descending
      localNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      setNotes(localNotes);

      const queue = await getPendingSyncQueue();
      setPendingCount(queue.length);

      // Check if any note has an active conflict
      const conflicted = localNotes.find((n) => n.syncStatus === 'conflict' && n.conflictingRemote);
      if (conflicted && !conflictNote) {
        setConflictNote(conflicted);
      }
    } catch (err) {
      console.error('[useNotes refresh error]', err);
    } finally {
      setLoading(false);
    }
  }, [conflictNote]);

  useEffect(() => {
    refresh();

    // Subscribe to SyncManager events
    const unsubscribe = syncManager.subscribe(async (event, payload) => {
      if (event === 'network_change') {
        setIsOnline(payload.isOnline);
      } else if (event === 'sync_start') {
        setIsSyncing(true);
      } else if (event === 'sync_complete' || event === 'sync_error') {
        setIsSyncing(false);
        refresh();
      } else if (event === 'conflict_detected') {
        const note = await getLocalNoteById(payload.noteId);
        if (note) {
          setConflictNote(note);
        }
        refresh();
      } else {
        refresh();
      }
    });

    return () => unsubscribe();
  }, [refresh]);

  // Actions
  const createNewNote = async () => {
    const newNote = await syncManager.createNote({
      title: 'Untitled Note',
      content: '',
      tags: [],
    });
    setActiveNoteId(newNote._id);
    await refresh();
    return newNote;
  };

  const updateCurrentNote = async (id, data) => {
    const updated = await syncManager.updateNote(id, data);
    await refresh();
    return updated;
  };

  const deleteCurrentNote = async (id) => {
    await syncManager.deleteNote(id);
    if (activeNoteId === id) {
      setActiveNoteId(null);
    }
    await refresh();
  };

  const manualSync = async () => {
    await syncManager.triggerSync();
    await refresh();
  };

  const toggleSimulatedOffline = () => {
    const nextState = !syncManager.isSimulatedOffline;
    syncManager.setSimulatedOffline(nextState);
    setIsOnline(syncManager.isOnline());
  };

  const handleResolveConflict = async (noteId, resolutionType, resolvedData) => {
    await syncManager.resolveConflict(noteId, resolutionType, resolvedData);
    setConflictNote(null);
    await refresh();
  };

  const activeNote = notes.find((n) => n._id === activeNoteId) || null;

  return {
    notes,
    activeNote,
    activeNoteId,
    setActiveNoteId,
    loading,
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
    isSimulatedOffline: syncManager.isSimulatedOffline,
    resolveConflict: handleResolveConflict,
    refresh,
  };
}
