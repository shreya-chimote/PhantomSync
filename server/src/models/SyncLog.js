const mongoose = require('mongoose');
const memoryStore = require('../config/memoryStore');

const syncLogSchema = new mongoose.Schema(
  {
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    clientId: {
      type: String,
      default: 'unknown-client',
    },
    noteId: {
      type: String,
      index: true,
    },
    action: {
      type: String,
      enum: ['create', 'update', 'delete', 'batch'],
      required: true,
    },
    responseStatus: {
      type: Number,
      required: true,
    },
    responseData: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

syncLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

const MongooseSyncLog = mongoose.model('SyncLog', syncLogSchema);

const SyncLogProxy = new Proxy(MongooseSyncLog, {
  get(target, prop) {
    if (memoryStore.isInMemory) {
      if (prop === 'findOne') return (...args) => memoryStore.syncLogs.findOne(...args);
      if (prop === 'create') return (...args) => memoryStore.syncLogs.create(...args);
      if (prop === 'deleteMany') return (...args) => memoryStore.syncLogs.deleteMany(...args);
    }
    return target[prop];
  },
});

module.exports = SyncLogProxy;
