const jwt = require('jsonwebtoken');
const User = require('./models/User');
const { getSecret } = require('./middleware/auth');
const { presentMessage } = require('./lib/present');
const { saveMessage } = require('./lib/messages');

let io = null;
const online = new Map();

function initSocket(server) {
  const { Server } = require('socket.io');
  const clientOrigin = process.env.CLIENT_ORIGIN || '*';
  const origin = clientOrigin.split(',').map((item) => item.trim()).filter(Boolean);
  io = new Server(server, {
    cors: { origin: origin.includes('*') ? '*' : origin, methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Sign in required'));
      const payload = jwt.verify(token, getSecret());
      const user = await User.findById(payload.userId);
      if (!user || !user.coupleId) return next(new Error('Pairing required'));
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Session expired'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    const room = `couple:${user.coupleId}`;
    socket.join(room);
    online.set(String(user._id), socket.id);
    socket.to(room).emit('presence', { userId: user._id, online: true });

    socket.on('message:send', async (body, ack) => {
      try {
        const Couple = require('./models/Couple');
        const couple = await Couple.findById(user.coupleId);
        const message = await saveMessage(user, couple, body || {});
        if (typeof ack === 'function') ack({ message: presentMessage(message) });
      } catch (error) {
        if (typeof ack === 'function') ack({ error: error.message || 'Could not send' });
      }
    });

    socket.on('typing', (isTyping) => {
      socket.to(room).emit('typing', { userId: user._id, isTyping: Boolean(isTyping) });
    });

    socket.on('call:signal', (payload) => {
      socket.to(room).emit('call:signal', {
        from: user._id,
        kind: payload?.kind,
        callType: payload?.callType,
        data: payload?.data,
      });
    });

    socket.on('disconnect', () => {
      if (online.get(String(user._id)) === socket.id) online.delete(String(user._id));
      socket.to(room).emit('presence', { userId: user._id, online: false });
    });
  });

  return io;
}

function getIo() {
  return io;
}

function isOnline(userId) {
  return online.has(String(userId));
}

module.exports = { initSocket, getIo, isOnline };
