const mongoose = require('mongoose');
const memoryStore = require('./memoryStore');

let isConnected = false;

/**
 * Connect to MongoDB with automatic fallback to Built-in In-Memory Database Store.
 * This guarantees zero installation headaches on Windows, blazing-fast startup,
 * and 100% test reliability for learners and interview demos.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/phantomsync';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000, // Fast failover if local daemon is not running
    });
    console.log(`[Database] Connected to external MongoDB at: ${conn.connection.host}`);
    memoryStore.isInMemory = false;
    isConnected = true;
    return conn;
  } catch (err) {
    console.warn(`[Database] External MongoDB not reachable (${err.message}).`);
    console.log(`[Database] Switching to built-in high-performance in-memory database store!`);
    memoryStore.isInMemory = true;
    isConnected = true;
    return { connection: { host: 'in-memory-store' } };
  }
}

/**
 * Gracefully disconnect from database
 */
async function disconnectDB() {
  try {
    if (!memoryStore.isInMemory && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (memoryStore.isInMemory) {
      memoryStore.clearAll();
    }
    isConnected = false;
    console.log(`[Database] Disconnected cleanly.`);
  } catch (err) {
    console.error(`[Database] Error during disconnect:`, err.message);
  }
}

module.exports = { connectDB, disconnectDB };
