const request = require('supertest');
const app = require('../src/app');
const Note = require('../src/models/Note');
require('./setup');

describe('Conflict Detection and Resolution (Optimistic Concurrency Control)', () => {
  it('should detect concurrent edits and return HTTP 409 Conflict without overwriting', async () => {
    // 1. Create initial note at version 1
    const createRes = await request(app).post('/api/notes').send({
      title: 'Distributed Systems',
      content: 'Base content about consensus',
    });
    const noteId = createRes.body.note._id;
    expect(createRes.body.note.version).toBe(1);

    // 2. Client A edits online: updates note from baseVersion 1 to version 2
    const clientAUpdate = await request(app)
      .put(`/api/notes/${noteId}`)
      .send({
        title: 'Distributed Systems - Client A',
        content: 'Client A added Raft algorithm details',
        baseVersion: 1,
        clientId: 'client-A',
      });
    expect(clientAUpdate.status).toBe(200);
    expect(clientAUpdate.body.note.version).toBe(2);

    // 3. Client B was offline or had stale state (still at baseVersion 1).
    // Client B attempts to update the note with baseVersion 1.
    const clientBUpdate = await request(app)
      .put(`/api/notes/${noteId}`)
      .send({
        title: 'Distributed Systems - Client B',
        content: 'Client B added Paxos consensus details',
        baseVersion: 1, // Stale base version!
        clientId: 'client-B',
      });

    // 4. Verify HTTP 409 Conflict is returned
    expect(clientBUpdate.status).toBe(409);
    expect(clientBUpdate.body.error).toBe('ConflictDetected');
    expect(clientBUpdate.body.serverNote.version).toBe(2);
    expect(clientBUpdate.body.serverNote.title).toBe('Distributed Systems - Client A');
    expect(clientBUpdate.body.attemptedUpdate.title).toBe('Distributed Systems - Client B');

    // 5. Verify the server did NOT overwrite Client A's changes
    const verifyServerNote = await Note.findById(noteId);
    expect(verifyServerNote.version).toBe(2);
    expect(verifyServerNote.title).toBe('Distributed Systems - Client A');
    expect(verifyServerNote.content).toBe('Client A added Raft algorithm details');

    // 6. Client B resolves the conflict by reviewing both versions and submitting a resolved version
    const resolutionRes = await request(app)
      .put(`/api/notes/${noteId}`)
      .send({
        title: 'Distributed Systems (Raft + Paxos)',
        content: 'Merged: Raft algorithm details and Paxos consensus details',
        baseVersion: 2,
        isConflictResolution: true,
        clientId: 'client-B',
      });

    expect(resolutionRes.status).toBe(200);
    expect(resolutionRes.body.note.version).toBe(3);
    expect(resolutionRes.body.note.title).toBe('Distributed Systems (Raft + Paxos)');
  });
});
