import {
  getLocalNotes,
  getLocalNoteById,
  saveLocalNote,
  softDeleteLocalNote,
  permanentlyDeleteLocalNote,
  enqueueSyncOperation,
  getPendingSyncQueue,
  dequeueSyncOperation,
  clearQueueForNote,
  getMetadata,
  setMetadata,
} from '../db/indexedDb.js';
import { api } from './api.js';

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.isSimulatedOffline = false;
    this.listeners = new Set();
    this.clientId = null;
    this.syncIntervalId = null;
    this.consecutiveFailures = 0;
    this.retryTimeoutId = null;

    this.init();
  }

  async init() {
    // Generate or retrieve persistent clientId
    let savedId = await getMetadata('clientId');
    if (!savedId) {
      savedId = `client-${crypto.randomUUID().slice(0, 8)}`;
      await setMetadata('clientId', savedId);
    }
    this.clientId = savedId;

    // Listen to browser network connectivity events
    window.addEventListener('online', () => {
      console.log('[SyncManager] Browser network returned online.');
      this.notifyListeners('network_change', { isOnline: this.isOnline() });
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      console.log('[SyncManager] Browser network went offline.');
      this.notifyListeners('network_change', { isOnline: this.isOnline() });
    });

    // Background heartbeat sync every 15 seconds
    this.syncIntervalId = setInterval(() => {
      if (this.isOnline() && !this.isSyncing) {
        this.triggerSync({ background: true });
      }
    }, 15000);
  }

  /**
   * Check if online taking both browser network and manual simulation toggle into account
   */
  isOnline() {
    return navigator.onLine && !this.isSimulatedOffline;
  }

  /**
   * Toggle manual network simulation (useful for demos and testing offline behavior)
   */
  setSimulatedOffline(isOffline) {
    this.isSimulatedOffline = isOffline;
    console.log(`[SyncManager] Simulated offline set to: ${isOffline}`);
    this.notifyListeners('network_change', { isOnline: this.isOnline() });

    if (!isOffline) {
      this.triggerSync();
    }
  }

  /**
   * Register event listener for UI components
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(event, payload) {
    this.listeners.forEach((listener) => {
      try {
        listener(event, payload);
      } catch (err) {
        console.error('[SyncManager Listener Error]', err);
      }
    });
  }

  /**
   * Create Note - Optimistic offline-first creation
   */
  async createNote({ title, content, tags }) {
    const noteId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newNote = {
      _id: noteId,
      title: title || 'Untitled Note',
      content: content || '',
      tags: tags || [],
      version: 1,
      baseVersion: 0,
      syncStatus: this.isOnline() ? 'syncing' : 'pending_create',
      updatedAt: now,
      isDeleted: false,
    };

    // 1. Save immediately to local IndexedDB
    await saveLocalNote(newNote);

    // 2. Queue for server sync
    await enqueueSyncOperation({
      noteId,
      action: 'create',
      baseVersion: 0,
      data: {
        title: newNote.title,
        content: newNote.content,
        tags: newNote.tags,
        clientUpdatedAt: now,
      },
      idempotencyKey: crypto.randomUUID(),
    });

    this.notifyListeners('note_created', newNote);

    // 3. Trigger sync in background
    if (this.isOnline()) {
      this.triggerSync();
    }

    return newNote;
  }

  /**
   * Update Note - Optimistic offline-first update
   */
  async updateNote(id, { title, content, tags }) {
    const existing = await getLocalNoteById(id);
    if (!existing) throw new Error('Note not found in local storage');

    const now = new Date().toISOString();
    const baseVersion = existing.baseVersion !== undefined ? existing.baseVersion : existing.version;

    const updatedNote = {
      ...existing,
      title: title !== undefined ? title : existing.title,
      content: content !== undefined ? content : existing.content,
      tags: tags !== undefined ? tags : existing.tags,
      updatedAt: now,
      syncStatus: this.isOnline() ? 'syncing' : 'pending_update',
    };

    await saveLocalNote(updatedNote);

    await enqueueSyncOperation({
      noteId: id,
      action: 'update',
      baseVersion,
      data: {
        title: updatedNote.title,
        content: updatedNote.content,
        tags: updatedNote.tags,
        clientUpdatedAt: now,
      },
      idempotencyKey: crypto.randomUUID(),
    });

    this.notifyListeners('note_updated', updatedNote);

    if (this.isOnline()) {
      this.triggerSync();
    }

    return updatedNote;
  }

  /**
   * Delete Note - Optimistic soft deletion
   */
  async deleteNote(id) {
    const existing = await getLocalNoteById(id);
    if (!existing) return;

    // Prune offline created notes that were never synced to server
    const queue = await getPendingSyncQueue();
    const pendingCreate = queue.find((q) => q.noteId === id && q.action === 'create');
    if (pendingCreate) {
      await clearQueueForNote(id);
      await permanentlyDeleteLocalNote(id);
      this.notifyListeners('note_deleted', { _id: id });
      return;
    }

    await softDeleteLocalNote(id);

    await enqueueSyncOperation({
      noteId: id,
      action: 'delete',
      baseVersion: existing.version,
      idempotencyKey: crypto.randomUUID(),
    });

    this.notifyListeners('note_deleted', { _id: id });

    if (this.isOnline()) {
      this.triggerSync();
    }
  }

  /**
   * Main synchronization loop
   */
  async triggerSync(options = {}) {
    if (this.isSyncing) return;
    if (!this.isOnline()) {
      console.log('[SyncManager] Cannot sync: client is offline.');
      return;
    }

    this.isSyncing = true;
    this.notifyListeners('sync_start', {});

    try {
      const queue = await getPendingSyncQueue();
      const lastSyncedAt = await getMetadata('lastSyncedAt');

      // Prepare operations payload
      const operations = queue
        .filter((item) => item.status !== 'conflict') // do not re-send conflicted items until resolved
        .map((item) => ({
          idempotencyKey: item.idempotencyKey,
          action: item.action,
          noteId: item.noteId,
          baseVersion: item.baseVersion,
          data: item.data,
          isConflictResolution: item.isConflictResolution || false,
        }));

      // Call batch synchronization endpoint
      const res = await api.syncBatch({
        clientId: this.clientId,
        operations,
        lastSyncedAt,
      });

      if (!res.ok) {
        this.consecutiveFailures++;
        const backoffDelay = Math.min(30000, 1000 * Math.pow(2, this.consecutiveFailures)) + Math.random() * 500;
        console.warn(`[SyncManager] Sync failed (attempt ${this.consecutiveFailures}). Retrying in ${Math.round(backoffDelay)}ms...`);
        
        if (this.retryTimeoutId) clearTimeout(this.retryTimeoutId);
        this.retryTimeoutId = setTimeout(() => {
          if (this.isOnline()) this.triggerSync();
        }, backoffDelay);

        this.notifyListeners('sync_error', { error: res.error });
        return;
      }

      // Reset failure counter on successful synchronization
      this.consecutiveFailures = 0;
      if (this.retryTimeoutId) clearTimeout(this.retryTimeoutId);

      const { processedOperations = [], serverChanges = [], serverTimestamp } = res.data;

      // 1. Process operation results
      for (const opResult of processedOperations) {
        const queueItem = queue.find((q) => q.noteId === opResult.noteId);

        if (opResult.status === 'created' || opResult.status === 'updated' || opResult.status === 'synced_already') {
          // Operation succeeded: update local note to match server
          if (queueItem) {
            await dequeueSyncOperation(queueItem.id);
          }

          if (opResult.note) {
            const local = await getLocalNoteById(opResult.note._id);
            await saveLocalNote({
              ...(local || {}),
              ...opResult.note,
              baseVersion: opResult.note.version,
              syncStatus: 'synced',
              conflictingRemote: null,
            });
          }
        } else if (opResult.status === 'conflict') {
          // CONFLICT DETECTED!
          console.warn('[SyncManager] Conflict received for note:', opResult.noteId);

          const localNote = await getLocalNoteById(opResult.noteId);
          if (localNote) {
            localNote.syncStatus = 'conflict';
            localNote.conflictingRemote = opResult.serverNote;
            await saveLocalNote(localNote);
          }

          this.notifyListeners('conflict_detected', {
            noteId: opResult.noteId,
            serverNote: opResult.serverNote,
            attempted: opResult.attempted,
          });
        } else if (opResult.status === 'deleted' || opResult.status === 'deleted_already') {
          if (queueItem) {
            await dequeueSyncOperation(queueItem.id);
          }
          await permanentlyDeleteLocalNote(opResult.noteId);
        }
      }

      // 2. Reconcile external changes from other clients
      for (const serverNote of serverChanges) {
        // Skip if this note is currently in a local pending queue
        const hasPendingLocal = queue.some((q) => q.noteId === serverNote._id);
        if (hasPendingLocal) continue;

        if (serverNote.isDeleted) {
          await permanentlyDeleteLocalNote(serverNote._id);
        } else {
          await saveLocalNote({
            ...serverNote,
            baseVersion: serverNote.version,
            syncStatus: 'synced',
            conflictingRemote: null,
          });
        }
      }

      // 3. Update lastSyncedAt timestamp
      if (serverTimestamp) {
        await setMetadata('lastSyncedAt', serverTimestamp);
      }

      this.notifyListeners('sync_complete', {
        processedCount: processedOperations.length,
        changesCount: serverChanges.length,
      });
    } catch (err) {
      console.error('[SyncManager Error]', err);
      this.notifyListeners('sync_error', { error: err.message });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Explicit Conflict Resolution Handler
   * Lets user choose:
   * - 'keep_local': submit local edits with baseVersion = serverNote.version
   * - 'keep_server': accept server state directly
   * - 'custom_merge': submit combined text with baseVersion = serverNote.version
   */
  async resolveConflict(noteId, resolutionType, resolvedData = {}) {
    const localNote = await getLocalNoteById(noteId);
    if (!localNote || !localNote.conflictingRemote) return;

    const serverNote = localNote.conflictingRemote;

    // Remove conflicting items from local outbox queue
    await clearQueueForNote(noteId);

    if (resolutionType === 'keep_server') {
      // Overwrite local copy with server note
      const resolved = {
        ...serverNote,
        baseVersion: serverNote.version,
        syncStatus: 'synced',
        conflictingRemote: null,
        updatedAt: new Date().toISOString(),
      };
      await saveLocalNote(resolved);
      this.notifyListeners('conflict_resolved', resolved);
      return resolved;
    }

    // For 'keep_local' or 'custom_merge'
    const finalTitle =
      resolutionType === 'keep_local'
        ? localNote.title
        : resolvedData.title !== undefined
        ? resolvedData.title
        : localNote.title;

    const finalContent =
      resolutionType === 'keep_local'
        ? localNote.content
        : resolvedData.content !== undefined
        ? resolvedData.content
        : localNote.content;

    const resolved = {
      ...localNote,
      title: finalTitle,
      content: finalContent,
      baseVersion: serverNote.version,
      syncStatus: this.isOnline() ? 'syncing' : 'pending_update',
      conflictingRemote: null,
      updatedAt: new Date().toISOString(),
    };

    await saveLocalNote(resolved);

    // Enqueue resolution operation
    await enqueueSyncOperation({
      noteId,
      action: 'update',
      baseVersion: serverNote.version,
      data: {
        title: finalTitle,
        content: finalContent,
        tags: resolved.tags || [],
      },
      isConflictResolution: true,
      idempotencyKey: crypto.randomUUID(),
    });

    this.notifyListeners('conflict_resolved', resolved);

    if (this.isOnline()) {
      this.triggerSync();
    }

    return resolved;
  }
}

export const syncManager = new SyncManager();
