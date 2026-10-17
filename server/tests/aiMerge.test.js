const request = require('supertest');
const app = require('../src/app');

describe('AI Merge Suggestion Engine (Zero API Key Fallback)', () => {
  it('should generate clean 3-way merge suggestions without needing an API key', async () => {
    const payload = {
      baseNote: {
        title: 'Sprint Planning',
        content: 'Item 1: Setup DB\nItem 2: Build API\nItem 3: Launch',
      },
      remoteNote: {
        title: 'Sprint Planning (Server)',
        content: 'Item 1: Setup DB with MongoDB\nItem 2: Build API\nItem 3: Launch',
      },
      localNote: {
        title: 'Sprint Planning',
        content: 'Item 1: Setup DB\nItem 2: Build API\nItem 3: Launch\nItem 4: Write Tests',
      },
    };

    const res = await request(app).post('/api/ai/suggest-merge').send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.suggestion).toBeDefined();
    expect(res.body.suggestion.mergedTitle).toBe('Sprint Planning (Server)');
    // Contains edits from both sides
    expect(res.body.suggestion.mergedContent).toContain('Item 1: Setup DB with MongoDB');
    expect(res.body.suggestion.mergedContent).toContain('Item 4: Write Tests');
    expect(res.body.suggestion.confidence).toBeGreaterThan(0.7);
  });
});
