require('dotenv').config(); // must be first
const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const { attachSocket } = require('./socket');

const PORT = process.env.PORT || 3000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    const server = http.createServer(app);
    const io = attachSocket(server);
    app.set('io', io);
    server.listen(PORT, () => console.log(`Server running on port ${PORT} (REST + WebSocket)`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
