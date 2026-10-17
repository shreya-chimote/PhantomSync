const request = require('supertest');
const app = require('../src/app');
require('./setup');

describe('Notes CRUD and OCC API', () => {
  it('should create a new note with version 1', async () => {
    const res = await request(app)
      .post('/api/notes')
      .send({
        title: 'Meeting Notes',
        content: 'Discussing offline architecture',
        tags: ['architecture', 'offline'],
        clientId: 'client-1',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.note.title).toBe('Meeting Notes');
    expect(res.body.note.version).toBe(1);
    expect(res.body.note.isDeleted).toBe(false);
  });

  it('should fetch active notes and exclude soft-deleted notes', async () => {
    const createRes = await request(app).post('/api/notes').send({
      title: 'Active Note',
      content: 'This note is active',
    });
    const noteId = createRes.body.note._id;

    // Delete it
    await request(app).delete(`/api/notes/${noteId}`).send({ clientId: 'client-1' });

    // Fetch notes without deleted
    const fetchRes = await request(app).get('/api/notes');
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.notes.find((n) => n._id === noteId)).toBeUndefined();

    // Fetch notes including deleted tombstones
    const fetchWithDeleted = await request(app).get('/api/notes?includeDeleted=true');
    expect(fetchWithDeleted.status).toBe(200);
    expect(fetchWithDeleted.body.notes.find((n) => n._id === noteId)).toBeDefined();
  });

  it('should increment version when updating a note', async () => {
    const createRes = await request(app).post('/api/notes').send({
      title: 'Original Title',
      content: 'Original content',
    });
    const noteId = createRes.body.note._id;

    const updateRes = await request(app)
      .put(`/api/notes/${noteId}`)
      .send({
        title: 'Updated Title',
        content: 'Updated content',
        baseVersion: 1,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.note.title).toBe('Updated Title');
    expect(updateRes.body.note.version).toBe(2);
  });
});
