require('dotenv').config(); // must be first
const http = require('http');
const https = require('https');
const mongoose = require('mongoose');
const app = require('./app');
const { attachSocket } = require('./socket');
const { startRecallScheduler } = require('./services/recallScheduler');
const { startVideoWorker } = require('./services/videoService');

const PORT = process.env.PORT || 3000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    const server = http.createServer(app);
    const io = attachSocket(server);
    app.set('io', io);
    startRecallScheduler();
    startVideoWorker();
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT} (REST + WebSocket)`);
      const base = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
      const client = base.startsWith('https') ? https : http;
      setInterval(() => client.get(`${base}/healthz`).on('error', () => {}), 15000);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
