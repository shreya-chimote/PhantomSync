const mongoose = require('mongoose');
const memoryStore = require('../config/memoryStore');

const noteHistorySchema = new mongoose.Schema(
  {
    noteId: {
      type: String,
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      default: '',
    },
    tags: {
      type: [String],
      default: [],
    },
    changeType: {
      type: String,
      enum: ['create', 'update', 'restore', 'conflict_resolved', 'delete'],
      default: 'update',
    },
    summary: {
      type: String,
      default: '',
    },
    savedBy: {
      type: String,
      default: 'anonymous',
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

noteHistorySchema.index({ noteId: 1, version: -1 });

const MongooseNoteHistory = mongoose.model('NoteHistory', noteHistorySchema);

const NoteHistoryProxy = new Proxy(MongooseNoteHistory, {
  get(target, prop) {
    if (memoryStore.isInMemory) {
      if (prop === 'find') return (...args) => memoryStore.histories.find(...args);
      if (prop === 'findOne') return (...args) => memoryStore.histories.findOne(...args);
      if (prop === 'create') return (...args) => memoryStore.histories.create(...args);
      if (prop === 'deleteMany') return (...args) => memoryStore.histories.deleteMany(...args);
    }
    return target[prop];
  },
});

module.exports = NoteHistoryProxy;
