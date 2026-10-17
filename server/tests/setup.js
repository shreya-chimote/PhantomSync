const memoryStore = require('../src/config/memoryStore');

beforeAll(async () => {
  memoryStore.isInMemory = true;
});

afterEach(async () => {
  // Clear all collections between tests for test isolation
  memoryStore.clearAll();
});
