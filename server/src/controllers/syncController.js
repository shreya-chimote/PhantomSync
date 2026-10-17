const Note = require('../models/Note');
const NoteHistory = require('../models/NoteHistory');
const SyncLog = require('../models/SyncLog');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/sync/batch
 * Processes an offline queue batch of operations with idempotency and conflict detection,
 * and simultaneously returns server updates modified since lastSyncedAt.
 */
async function syncBatch(req, res) {
  try {
    const { clientId = 'unknown-client', operations = [], lastSyncedAt } = req.body;

    const processedResults = [];

    for (const op of operations) {
      const { idempotencyKey, action, noteId, baseVersion, data = {}, isConflictResolution } = op;

      if (!idempotencyKey) {
        processedResults.push({
          noteId,
          action,
          status: 'error',
          error: 'Missing idempotencyKey',
        });
        continue;
      }

      // 1. Check for Duplicate / Retried Request (Idempotency)
      const existingLog = await SyncLog.findOne({ idempotencyKey });
      if (existingLog) {
        processedResults.push({
          ...existingLog.responseData,
          isDuplicateReplay: true,
        });
        continue;
      }

      let opResult = null;

      // 2. Process Action
      if (action === 'create') {
        const existingNote = await Note.findById(noteId);
        if (existingNote) {
          // If note exists already, treat as conflict unless data matches exactly
          if (existingNote.title === data.title && existingNote.content === data.content) {
            opResult = {
              noteId,
              action,
              status: 'synced_already',
              note: existingNote,
            };
          } else {
            opResult = {
              noteId,
              action,
              status: 'conflict',
              serverNote: existingNote,
              attempted: data,
              baseVersion: 0,
            };
          }
        } else {
          const newNote = new Note({
            _id: noteId,
            title: data.title !== undefined ? data.title : 'Untitled Note',
            content: data.content || '',
            tags: Array.isArray(data.tags) ? data.tags : [],
            version: 1,
            isDeleted: false,
            lastModifiedBy: clientId,
            clientUpdatedAt: data.clientUpdatedAt ? new Date(data.clientUpdatedAt) : new Date(),
          });
          await newNote.save();

          await NoteHistory.create({
            noteId: newNote._id,
            version: 1,
            title: newNote.title,
            content: newNote.content,
            tags: newNote.tags,
            changeType: 'create',
            summary: 'Created offline and synced',
            savedBy: clientId,
          });

          opResult = {
            noteId,
            action,
            status: 'created',
            note: newNote,
          };
        }
      } else if (action === 'update') {
        const existingNote = await Note.findById(noteId);

        if (!existingNote) {
          opResult = {
            noteId,
            action,
            status: 'error',
            error: 'NoteNotFoundOnServer',
            message: 'Cannot update a note that does not exist on the server.',
          };
        } else if (!isConflictResolution && baseVersion !== undefined && existingNote.version !== Number(baseVersion)) {
          // CONFLICT DETECTED!
          // Server version is ahead of the client's baseVersion
          opResult = {
            noteId,
            action,
            status: 'conflict',
            serverNote: existingNote,
            attempted: {
              title: data.title,
              content: data.content,
              tags: data.tags,
              baseVersion,
            },
          };
        } else {
          // No conflict or explicitly resolved
          const nextVersion = existingNote.version + 1;
          if (data.title !== undefined) existingNote.title = data.title;
          if (data.content !== undefined) existingNote.content = data.content;
          if (data.tags !== undefined) existingNote.tags = Array.isArray(data.tags) ? data.tags : [];
          existingNote.version = nextVersion;
          existingNote.isDeleted = false;
          existingNote.lastModifiedBy = clientId;
          existingNote.clientUpdatedAt = new Date();

          await existingNote.save();

          await NoteHistory.create({
            noteId: existingNote._id,
            version: nextVersion,
            title: existingNote.title,
            content: existingNote.content,
            tags: existingNote.tags,
            changeType: isConflictResolution ? 'conflict_resolved' : 'update',
            summary: isConflictResolution ? 'Conflict resolution applied' : `Synced update v${nextVersion}`,
            savedBy: clientId,
          });

          opResult = {
            noteId,
            action,
            status: 'updated',
            note: existingNote,
          };
        }
      } else if (action === 'delete') {
        const existingNote = await Note.findById(noteId);
        if (existingNote) {
          const nextVersion = existingNote.version + 1;
          existingNote.isDeleted = true;
          existingNote.deletedAt = new Date();
          existingNote.version = nextVersion;
          existingNote.lastModifiedBy = clientId;
          await existingNote.save();

          await NoteHistory.create({
            noteId: existingNote._id,
            version: nextVersion,
            title: existingNote.title,
            content: existingNote.content,
            tags: existingNote.tags,
            changeType: 'delete',
            summary: 'Synced deletion',
            savedBy: clientId,
          });

          opResult = {
            noteId,
            action,
            status: 'deleted',
            noteId,
          };
        } else {
          opResult = {
            noteId,
            action,
            status: 'deleted_already',
            noteId,
          };
        }
      } else {
        opResult = {
          noteId,
          action,
          status: 'error',
          error: `Unsupported action: ${action}`,
        };
      }

      // 3. Save to SyncLog for Idempotency
      try {
        await SyncLog.create({
          idempotencyKey,
          clientId,
          noteId,
          action,
          responseStatus: opResult.status === 'conflict' ? 409 : 200,
          responseData: opResult,
        });
      } catch (logErr) {
        console.warn(`[SyncLog] Failed to record idempotency log:`, logErr.message);
      }

      processedResults.push(opResult);
    }

    // 4. Fetch incremental updates from server that happened since client's last sync
    const filter = {};
    if (lastSyncedAt) {
      filter.updatedAt = { $gt: new Date(lastSyncedAt) };
    }
    const serverChanges = await Note.find(filter).lean();

    return res.status(200).json({
      success: true,
      processedOperations: processedResults,
      serverChanges,
      serverTimestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[syncBatch Error]', err);
    return res.status(500).json({ success: false, error: 'Batch sync processing failed' });
  }
}

module.exports = {
  syncBatch,
};
