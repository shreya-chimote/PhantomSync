const express = require('express');
const cors = require('cors');
const noteRoutes = require('./routes/noteRoutes');
const syncRoutes = require('./routes/syncRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

// Middlewares
app.use(
  cors({
    origin: '*', // Allow connections from Vite frontend and local tools
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Id'],
  })
);

app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'PhantomSync-AI Server',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/notes', noteRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/ai', aiRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Centralized Error Handling
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

module.exports = app;
