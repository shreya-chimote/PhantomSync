const request = require('supertest');
const app = require('../src/app');
const Note = require('../src/models/Note');
require('./setup');

describe('Batch Synchronization & Idempotency Engine', () => {
  it('should process batch offline operations and return server state', async () => {
    const offlineNoteId = 'offline-note-uuid-101';

    const batchPayload = {
      clientId: 'mobile-client-99',
      operations: [
        {
          idempotencyKey: 'idemp-key-001',
          action: 'create',
          noteId: offlineNoteId,
          data: {
            title: 'Created Offline on Flight',
            content: 'Drafted architecture diagram notes while offline in airplane mode',
            tags: ['offline', 'travel'],
          },
        },
      ],
      lastSyncedAt: new Date(Date.now() - 3600000).toISOString(),
    };

    const res = await request(app).post('/api/sync/batch').send(batchPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.processedOperations.length).toBe(1);
    expect(res.body.processedOperations[0].status).toBe('created');
    expect(res.body.processedOperations[0].note.title).toBe('Created Offline on Flight');

    // Verify it exists in database
    const saved = await Note.findById(offlineNoteId);
    expect(saved).toBeDefined();
    expect(saved.version).toBe(1);
  });

  it('should safely handle duplicate retries using idempotency key without duplicate side-effects', async () => {
    const noteId = 'idemp-note-202';
    const idempotencyKey = 'unique-retry-key-777';

    const operation = {
      idempotencyKey,
      action: 'create',
      noteId,
      data: {
        title: 'Network Retry Test',
        content: 'Original payload',
      },
    };

    // First attempt (e.g. server processes, but client connection dropped before receiving response)
    const firstRes = await request(app)
      .post('/api/sync/batch')
      .send({ clientId: 'client-retry', operations: [operation] });

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.processedOperations[0].status).toBe('created');

    // Second attempt (client retries with the same idempotencyKey)
    const retryRes = await request(app)
      .post('/api/sync/batch')
      .send({ clientId: 'client-retry', operations: [operation] });

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.processedOperations[0].isDuplicateReplay).toBe(true);

    // Verify document was not mutated or duplicated
    const count = await Note.countDocuments({ _id: noteId });
    expect(count).toBe(1);
  });

  it('should detect conflicts during batch sync without overwriting server state', async () => {
    // 1. Create note on server (v1)
    const createRes = await request(app).post('/api/notes').send({
      title: 'Roadmap Q4',
      content: 'Initial roadmap',
    });
    const noteId = createRes.body.note._id;

    // 2. Server updates to v2
    await request(app).put(`/api/notes/${noteId}`).send({
      title: 'Roadmap Q4 - Server Updated',
      content: 'Added budget items on server',
      baseVersion: 1,
    });

    // 3. Client attempts batch update with stale baseVersion: 1
    const syncRes = await request(app)
      .post('/api/sync/batch')
      .send({
        clientId: 'client-conflict',
        operations: [
          {
            idempotencyKey: 'op-conflict-1',
            action: 'update',
            noteId,
            baseVersion: 1, // Stale!
            data: {
              title: 'Roadmap Q4 - Offline Edit',
              content: 'Added offline hiring goals',
            },
          },
        ],
      });

    expect(syncRes.status).toBe(200);
    const opResult = syncRes.body.processedOperations[0];
    expect(opResult.status).toBe('conflict');
    expect(opResult.serverNote.version).toBe(2);
    expect(opResult.serverNote.title).toBe('Roadmap Q4 - Server Updated');

    // Server data must remain unmodified
    const noteAfter = await Note.findById(noteId);
    expect(noteAfter.title).toBe('Roadmap Q4 - Server Updated');
  });
});
