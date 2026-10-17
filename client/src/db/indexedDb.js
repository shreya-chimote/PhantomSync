import { openDB } from 'idb';

const DB_NAME = 'PhantomSyncDB';
const DB_VERSION = 1;

/**
 * Initialize IndexedDB with schema for notes, syncQueue, and metadata
 */
export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 1. Notes Store (Offline cache of all notes)
      if (!db.objectStoreNames.contains('notes')) {
        const noteStore = db.createObjectStore('notes', { keyPath: '_id' });
        noteStore.createIndex('updatedAt', 'updatedAt');
        noteStore.createIndex('syncStatus', 'syncStatus');
        noteStore.createIndex('isDeleted', 'isDeleted');
      }

      // 2. Sync Queue (Outbox for pending offline mutations)
      if (!db.objectStoreNames.contains('syncQueue')) {
        const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        queueStore.createIndex('noteId', 'noteId');
        queueStore.createIndex('timestamp', 'timestamp');
        queueStore.createIndex('status', 'status');
      }

      // 3. Metadata Store (Client settings, lastSyncedAt, clientId)
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    },
  });
}

/**
 * Fetch all local notes
 * @param {boolean} includeDeleted
 */
export async function getLocalNotes(includeDeleted = false) {
  const db = await getDB();
  const allNotes = await db.getAll('notes');

  if (includeDeleted) return allNotes;
  return allNotes.filter((n) => !n.isDeleted);
}

/**
 * Fetch a single note by ID
 */
export async function getLocalNoteById(id) {
  const db = await getDB();
  return db.get('notes', id);
}

/**
 * Save or update note in local IndexedDB
 */
export async function saveLocalNote(note) {
  const db = await getDB();
  const noteToSave = {
    ...note,
    updatedAt: note.updatedAt || new Date().toISOString(),
  };
  await db.put('notes', noteToSave);
  return noteToSave;
}

/**
 * Soft delete note locally
 */
export async function softDeleteLocalNote(id) {
  const db = await getDB();
  const note = await db.get('notes', id);
  if (note) {
    note.isDeleted = true;
    note.syncStatus = 'pending_delete';
    note.updatedAt = new Date().toISOString();
    await db.put('notes', note);
    return note;
  }
  return null;
}

/**
 * Permanently remove note from local storage
 */
export async function permanentlyDeleteLocalNote(id) {
  const db = await getDB();
  await db.delete('notes', id);
}

/**
 * Add operation to offline sync queue (Outbox)
 */
export async function enqueueSyncOperation(operation) {
  const db = await getDB();
  const queueItem = {
    id: operation.id || crypto.randomUUID(),
    noteId: operation.noteId,
    action: operation.action, // 'create' | 'update' | 'delete'
    baseVersion: operation.baseVersion,
    data: operation.data || {},
    idempotencyKey: operation.idempotencyKey || crypto.randomUUID(),
    timestamp: Date.now(),
    status: 'pending', // 'pending' | 'in_flight' | 'conflict' | 'failed'
    retryCount: 0,
  };
  await db.put('syncQueue', queueItem);
  return queueItem;
}

/**
 * Get all pending operations in chronological order
 */
export async function getPendingSyncQueue() {
  const db = await getDB();
  const items = await db.getAll('syncQueue');
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Remove an item from the sync queue once successfully processed
 */
export async function dequeueSyncOperation(id) {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

/**
 * Remove all queue items for a specific note (used when resolving conflicts)
 */
export async function clearQueueForNote(noteId) {
  const db = await getDB();
  const tx = db.transaction('syncQueue', 'readwrite');
  const index = tx.store.index('noteId');
  let cursor = await index.openCursor(noteId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

/**
 * Metadata Helpers
 */
export async function getMetadata(key, defaultValue = null) {
  const db = await getDB();
  const record = await db.get('metadata', key);
  return record ? record.value : defaultValue;
}

export async function setMetadata(key, value) {
  const db = await getDB();
  await db.put('metadata', { key, value });
}
