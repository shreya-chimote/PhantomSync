const mongoose = require('mongoose');
const memoryStore = require('../config/memoryStore');

const noteSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      default: 'Untitled Note',
      trim: true,
    },
    content: {
      type: String,
      default: '',
    },
    tags: {
      type: [String],
      default: [],
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    lastModifiedBy: {
      type: String,
      default: 'unknown-client',
    },
    clientUpdatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

noteSchema.index({ updatedAt: 1 });
noteSchema.index({ isDeleted: 1, updatedAt: 1 });

const MongooseNote = mongoose.model('Note', noteSchema);

// Proxy that routes to memoryStore if in-memory mode is active
const NoteProxy = new Proxy(MongooseNote, {
  get(target, prop) {
    if (memoryStore.isInMemory) {
      if (prop === 'find') return (...args) => memoryStore.notes.find(...args);
      if (prop === 'findById') return (...args) => memoryStore.notes.findById(...args);
      if (prop === 'findOne') return (...args) => memoryStore.notes.findOne(...args);
      if (prop === 'create') return (...args) => memoryStore.notes.create(...args);
      if (prop === 'countDocuments') return (...args) => memoryStore.notes.countDocuments(...args);
      if (prop === 'deleteMany') return (...args) => memoryStore.notes.deleteMany(...args);
    }
    return target[prop];
  },
  construct(target, args) {
    if (memoryStore.isInMemory) {
      const data = args[0] || {};
      const { Document } = require('../config/memoryStore');
      return new Document(data, memoryStore.notes);
    }
    return new target(...args);
  },
});

// Helper factory for creating notes reliably in both modes
NoteProxy.createInstance = function (data) {
  if (memoryStore.isInMemory) {
    const docData = {
      title: 'Untitled Note',
      content: '',
      tags: [],
      version: 1,
      isDeleted: false,
      ...data,
    };
    return memoryStore.notes.create(docData);
  }
  return new MongooseNote(data);
};

module.exports = NoteProxy;
