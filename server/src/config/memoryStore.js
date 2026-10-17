/**
 * PhantomSync Built-in In-Memory Database Store
 * Implements a lightweight, zero-dependency document store conforming to the Mongoose API.
 * Guarantees zero installation friction on Windows, blazing-fast tests, and instant dev startup.
 */

class Document {
  constructor(data, store) {
    Object.assign(this, JSON.parse(JSON.stringify(data)));
    this._store = store;
  }

  async save() {
    this.updatedAt = new Date();
    if (!this.createdAt) this.createdAt = new Date();

    const idx = this._store.data.findIndex((item) => item._id === this._id);
    const serialized = JSON.parse(JSON.stringify(this));
    delete serialized._store;

    if (idx >= 0) {
      this._store.data[idx] = serialized;
    } else {
      this._store.data.push(serialized);
    }
    return this;
  }

  toObject() {
    const copy = { ...this };
    delete copy._store;
    return copy;
  }
}

class MemoryCollection {
  constructor(name) {
    this.name = name;
    this.data = [];
  }

  _matchesFilter(item, filter = {}) {
    for (const key of Object.keys(filter)) {
      const condition = filter[key];

      if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
        if (condition.$gte !== undefined) {
          const itemVal = new Date(item[key]).getTime();
          const targetVal = new Date(condition.$gte).getTime();
          if (isNaN(itemVal) || itemVal < targetVal) return false;
          continue;
        }
        if (condition.$gt !== undefined) {
          const itemVal = new Date(item[key]).getTime();
          const targetVal = new Date(condition.$gt).getTime();
          if (isNaN(itemVal) || itemVal <= targetVal) return false;
          continue;
        }
      }

      if (item[key] !== condition) {
        return false;
      }
    }
    return true;
  }

  find(filter = {}) {
    const results = this.data.filter((item) => this._matchesFilter(item, filter));

    const queryObj = {
      _results: results.map((r) => new Document(r, this)),
      sort(sortObj = {}) {
        const sortKey = Object.keys(sortObj)[0];
        if (sortKey) {
          const dir = sortObj[sortKey];
          this._results.sort((a, b) => {
            if (dir < 0) return b[sortKey] > a[sortKey] ? 1 : -1;
            return a[sortKey] > b[sortKey] ? 1 : -1;
          });
        }
        return this;
      },
      lean() {
        return this._results.map((d) => d.toObject());
      },
      then(resolve, reject) {
        return Promise.resolve(this._results).then(resolve, reject);
      },
    };

    return queryObj;
  }

  async findById(id) {
    const found = this.data.find((item) => item._id === id);
    if (!found) return null;
    const doc = new Document(found, this);
    doc.lean = () => doc.toObject();
    return doc;
  }

  async findOne(filter = {}) {
    const found = this.data.find((item) => this._matchesFilter(item, filter));
    if (!found) return null;
    const doc = new Document(found, this);
    doc.lean = () => doc.toObject();
    return doc;
  }

  async create(data) {
    const now = new Date();
    const docData = {
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    if (!docData._id) {
      docData._id = crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}`;
    }
    this.data.push(JSON.parse(JSON.stringify(docData)));
    return new Document(docData, this);
  }

  async countDocuments(filter = {}) {
    return this.data.filter((item) => this._matchesFilter(item, filter)).length;
  }

  async deleteMany(filter = {}) {
    if (Object.keys(filter).length === 0) {
      this.data = [];
      return { deletedCount: 0 };
    }
    const initial = this.data.length;
    this.data = this.data.filter((item) => !this._matchesFilter(item, filter));
    return { deletedCount: initial - this.data.length };
  }

  clear() {
    this.data = [];
  }
}

const memoryStore = {
  isInMemory: false,
  notes: new MemoryCollection('notes'),
  histories: new MemoryCollection('histories'),
  syncLogs: new MemoryCollection('syncLogs'),

  clearAll() {
    this.notes.clear();
    this.histories.clear();
    this.syncLogs.clear();
  },
};

module.exports = memoryStore;
module.exports.Document = Document;
