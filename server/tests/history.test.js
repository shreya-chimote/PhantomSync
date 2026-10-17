const request = require('supertest');
const app = require('../src/app');
require('./setup');

describe('Version History & Point-in-Time Restore', () => {
  it('should maintain immutable revision history and restore earlier versions', async () => {
    // 1. Create Note (v1)
    const createRes = await request(app).post('/api/notes').send({
      title: 'Design Doc v1',
      content: 'Original microservices architecture',
    });
    const noteId = createRes.body.note._id;

    // 2. Update to v2
    await request(app).put(`/api/notes/${noteId}`).send({
      title: 'Design Doc v2',
      content: 'Switched to Event-Driven architecture',
      baseVersion: 1,
    });

    // 3. Update to v3
    await request(app).put(`/api/notes/${noteId}`).send({
      title: 'Design Doc v3',
      content: 'Added Serverless components',
      baseVersion: 2,
    });

    // 4. Retrieve Version History
    const historyRes = await request(app).get(`/api/notes/${noteId}/history`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.history.length).toBe(3);
    expect(historyRes.body.history[0].version).toBe(3);
    expect(historyRes.body.history[1].version).toBe(2);
    expect(historyRes.body.history[2].version).toBe(1);

    // 5. Restore version 1
    const restoreRes = await request(app)
      .post(`/api/notes/${noteId}/restore`)
      .send({ targetVersion: 1, clientId: 'dev-user' });

    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.note.version).toBe(4); // New revision created
    expect(restoreRes.body.note.title).toBe('Design Doc v1');
    expect(restoreRes.body.note.content).toBe('Original microservices architecture');

    // 6. Verify history now has 4 entries
    const historyAfterRestore = await request(app).get(`/api/notes/${noteId}/history`);
    expect(historyAfterRestore.body.history.length).toBe(4);
    expect(historyAfterRestore.body.history[0].changeType).toBe('restore');
  });
});
