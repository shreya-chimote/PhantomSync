const Note = require('../models/Note');
const NoteHistory = require('../models/NoteHistory');
const { v4: uuidv4 } = require('uuid');

/**
 * GET /api/notes
 * Supports incremental sync with ?since=<ISO timestamp>&includeDeleted=true
 */
async function getNotes(req, res) {
  try {
    const { since, includeDeleted } = req.query;
    const filter = {};

    if (since) {
      filter.updatedAt = { $gte: new Date(since) };
    }

    // By default, exclude soft-deleted notes unless explicitly syncing tombstones
    if (includeDeleted !== 'true') {
      filter.isDeleted = false;
    }

    const notes = await Note.find(filter).sort({ updatedAt: -1 }).lean();
    return res.status(200).json({ success: true, count: notes.length, notes });
  } catch (err) {
    console.error('[getNotes Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve notes' });
  }
}

/**
 * GET /api/notes/:id
 */
async function getNoteById(req, res) {
  try {
    const { id } = req.params;
    const note = await Note.findById(id).lean();

    if (!note || note.isDeleted) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    return res.status(200).json({ success: true, note });
  } catch (err) {
    console.error('[getNoteById Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve note' });
  }
}

/**
 * POST /api/notes
 * Create a new note (Supports offline-generated UUIDs)
 */
async function createNote(req, res) {
  try {
    const { _id, title, content, tags, clientId, clientUpdatedAt } = req.body;
    const noteId = _id || uuidv4();

    // Check if a note with this ID already exists
    const existing = await Note.findById(noteId);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'NoteAlreadyExists',
        message: 'A note with this ID already exists. Use PUT to update.',
        existingNote: existing,
      });
    }

    const newNote = new Note({
      _id: noteId,
      title: title !== undefined ? title : 'Untitled Note',
      content: content || '',
      tags: Array.isArray(tags) ? tags : [],
      version: 1,
      isDeleted: false,
      lastModifiedBy: clientId || 'web-client',
      clientUpdatedAt: clientUpdatedAt ? new Date(clientUpdatedAt) : new Date(),
    });

    await newNote.save();

    // Record immutable snapshot in version history
    await NoteHistory.create({
      noteId: newNote._id,
      version: 1,
      title: newNote.title,
      content: newNote.content,
      tags: newNote.tags,
      changeType: 'create',
      summary: 'Initial version created',
      savedBy: clientId || 'web-client',
    });

    return res.status(201).json({ success: true, note: newNote });
  } catch (err) {
    console.error('[createNote Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to create note' });
  }
}

/**
 * PUT /api/notes/:id
 * Optimistic Concurrency Control (OCC) update
 */
async function updateNote(req, res) {
  try {
    const { id } = req.params;
    const { title, content, tags, baseVersion, clientId, isConflictResolution, changeSummary } = req.body;

    const existingNote = await Note.findById(id);

    if (!existingNote) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // Check for concurrency conflict:
    // If baseVersion was provided and does not match server version, and user hasn't explicitly submitted a resolved version
    if (baseVersion !== undefined && baseVersion !== null && !isConflictResolution) {
      if (existingNote.version !== Number(baseVersion)) {
        // Concurrency conflict detected!
        // Never silently overwrite: return both versions so client can display side-by-side
        return res.status(409).json({
          success: false,
          error: 'ConflictDetected',
          message: `Conflict detected: Server is at version ${existingNote.version}, but client edited from base version ${baseVersion}.`,
          serverNote: existingNote,
          attemptedUpdate: {
            title,
            content,
            tags,
            baseVersion,
          },
        });
      }
    }

    // Apply update and increment version
    const nextVersion = existingNote.version + 1;
    if (title !== undefined) existingNote.title = title;
    if (content !== undefined) existingNote.content = content;
    if (tags !== undefined) existingNote.tags = Array.isArray(tags) ? tags : [];
    existingNote.version = nextVersion;
    existingNote.lastModifiedBy = clientId || 'web-client';
    existingNote.isDeleted = false; // Undelete if reviving
    existingNote.clientUpdatedAt = new Date();

    await existingNote.save();

    // Snapshot in history
    await NoteHistory.create({
      noteId: existingNote._id,
      version: nextVersion,
      title: existingNote.title,
      content: existingNote.content,
      tags: existingNote.tags,
      changeType: isConflictResolution ? 'conflict_resolved' : 'update',
      summary: changeSummary || (isConflictResolution ? 'Conflict manually resolved' : `Updated to v${nextVersion}`),
      savedBy: clientId || 'web-client',
    });

    return res.status(200).json({ success: true, note: existingNote });
  } catch (err) {
    console.error('[updateNote Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to update note' });
  }
}

/**
 * DELETE /api/notes/:id
 * Soft deletes note (Tombstone) to allow syncing deletions to offline clients
 */
async function deleteNote(req, res) {
  try {
    const { id } = req.params;
    const { clientId } = req.body;

    const note = await Note.findById(id);
    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    const nextVersion = note.version + 1;
    note.isDeleted = true;
    note.deletedAt = new Date();
    note.version = nextVersion;
    note.lastModifiedBy = clientId || 'web-client';

    await note.save();

    await NoteHistory.create({
      noteId: note._id,
      version: nextVersion,
      title: note.title,
      content: note.content,
      tags: note.tags,
      changeType: 'delete',
      summary: 'Note deleted',
      savedBy: clientId || 'web-client',
    });

    return res.status(200).json({ success: true, message: 'Note deleted successfully', noteId: id });
  } catch (err) {
    console.error('[deleteNote Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to delete note' });
  }
}

/**
 * GET /api/notes/:id/history
 * Fetch version history snapshots
 */
async function getNoteHistory(req, res) {
  try {
    const { id } = req.params;
    const history = await NoteHistory.find({ noteId: id }).sort({ version: -1 }).lean();

    return res.status(200).json({ success: true, history });
  } catch (err) {
    console.error('[getNoteHistory Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
}

/**
 * POST /api/notes/:id/restore
 * Restore note to a previous version snapshot
 */
async function restoreNoteVersion(req, res) {
  try {
    const { id } = req.params;
    const { targetVersion, clientId } = req.body;

    if (!targetVersion) {
      return res.status(400).json({ success: false, error: 'targetVersion is required' });
    }

    const targetSnapshot = await NoteHistory.findOne({ noteId: id, version: Number(targetVersion) });
    if (!targetSnapshot) {
      return res.status(404).json({ success: false, error: `Version ${targetVersion} not found in history` });
    }

    const currentNote = await Note.findById(id);
    if (!currentNote) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    const nextVersion = currentNote.version + 1;
    currentNote.title = targetSnapshot.title;
    currentNote.content = targetSnapshot.content;
    currentNote.tags = targetSnapshot.tags;
    currentNote.isDeleted = false;
    currentNote.version = nextVersion;
    currentNote.lastModifiedBy = clientId || 'web-client';

    await currentNote.save();

    await NoteHistory.create({
      noteId: currentNote._id,
      version: nextVersion,
      title: currentNote.title,
      content: currentNote.content,
      tags: currentNote.tags,
      changeType: 'restore',
      summary: `Restored from version ${targetVersion}`,
      savedBy: clientId || 'web-client',
    });

    return res.status(200).json({
      success: true,
      message: `Restored version ${targetVersion} as new revision v${nextVersion}`,
      note: currentNote,
    });
  } catch (err) {
    console.error('[restoreNoteVersion Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to restore version' });
  }
}

module.exports = {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  getNoteHistory,
  restoreNoteVersion,
};
