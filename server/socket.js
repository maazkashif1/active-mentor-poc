const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const ChatMessage = require('./models/chatMessageModel');
const { assertThreadAccess } = require('./services/chatAccess');

function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return next(new Error('Unauthorized'));
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const uid = String(socket.user.id);
    socket.join(`user:${uid}`);

    socket.on('thread:join', async (threadId, ack) => {
      try {
        const { error } = await assertThreadAccess(threadId, socket.user);
        if (error) {
          if (typeof ack === 'function') ack({ ok: false, message: error.message });
          return;
        }
        socket.join(`thread:${threadId}`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, message: e.message });
      }
    });

    socket.on('thread:leave', (threadId) => {
      socket.leave(`thread:${threadId}`);
    });

    socket.on('message:send', async ({ threadId, body } = {}, ack) => {
      try {
        const text = String(body || '').trim();
        if (!text) {
          if (typeof ack === 'function') ack({ ok: false, message: 'Empty message' });
          return;
        }
        const { thread, error } = await assertThreadAccess(threadId, socket.user);
        if (error) {
          if (typeof ack === 'function') ack({ ok: false, message: error.message });
          return;
        }

        const message = await ChatMessage.create({
          threadId: thread._id,
          senderId: socket.user.id,
          senderRole: socket.user.role,
          body: text,
        });

        thread.lastMessageAt = message.createdAt;
        thread.lastMessagePreview = text.slice(0, 140);
        thread.lastSenderRole = socket.user.role;
        if (socket.user.role === 'patient') {
          thread.physiologistUnread = (thread.physiologistUnread || 0) + 1;
        } else {
          thread.patientUnread = (thread.patientUnread || 0) + 1;
        }
        await thread.save();

        const payload = {
          message,
          threadId: String(thread._id),
          patientId: String(thread.patientId),
          physiologistId: String(thread.physiologistId),
        };
        io.to(`thread:${thread._id}`).emit('message:new', payload);
        io.to(`user:${thread.patientId}`).emit('thread:updated', { threadId: String(thread._id) });
        io.to(`user:${thread.physiologistId}`).emit('thread:updated', { threadId: String(thread._id) });

        if (typeof ack === 'function') ack({ ok: true, message });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, message: e.message });
      }
    });
  });

  return io;
}

module.exports = { attachSocket };
