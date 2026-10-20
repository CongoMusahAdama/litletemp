const jwt = require('jsonwebtoken');
const User = require('./models/User');
const { getSecret } = require('./middleware/auth');
const { presentMessage } = require('./lib/present');
const { saveMessage } = require('./lib/messages');
const { startGame, currentGame, clearGame, moveGame, viewGame, touchPlayer } = require('./lib/games');

let io = null;
// userId -> socket ids, so someone with two phones or tabs stays online until both close.
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
    socket.join(`user:${user._id}`);
    const me = String(user._id);
    if (!online.has(me)) online.set(me, new Set());
    online.get(me).add(socket.id);
    User.updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date() } }).catch(() => undefined);
    socket.to(room).emit('presence', { userId: user._id, online: true });

    // Tell this connection who else in the couple is online right now.
    const sendPresence = async () => {
      const peers = await io.in(room).fetchSockets();
      const seen = new Set();
      for (const peer of peers) {
        const id = String(peer.user?._id || '');
        if (!id || id === me || seen.has(id)) continue;
        seen.add(id);
        socket.emit('presence', { userId: id, online: true });
      }
    };
    sendPresence().catch(() => undefined);
    socket.on('presence:check', () => { sendPresence().catch(() => undefined); });

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

    const pushGame = async () => {
      const sockets = await io.in(room).fetchSockets();
      const state = await currentGame(user.coupleId);
      for (const peer of sockets) {
        peer.emit('game:state', state ? viewGame(state, peer.user._id) : null);
      }
    };

    socket.on('game:sync', async () => {
      const state = await currentGame(user.coupleId);
      if (!state) {
        socket.emit('game:state', null);
        return;
      }
      touchPlayer(state, user._id);
      await moveGame(user.coupleId, user._id, {});
      pushGame().catch(() => undefined);
    });

    socket.on('game:start', (kind) => {
      startGame(user.coupleId, kind, user._id)
        .then(() => pushGame())
        .catch(() => undefined);
    });

    socket.on('game:move', (move) => {
      moveGame(user.coupleId, user._id, move || {})
        .then(() => pushGame())
        .catch(() => undefined);
    });

    socket.on('game:leave', () => {
      clearGame(user.coupleId)
        .then(() => pushGame())
        .catch(() => undefined);
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
      const sockets = online.get(me);
      sockets?.delete(socket.id);
      if (sockets && sockets.size > 0) return;
      online.delete(me);
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
