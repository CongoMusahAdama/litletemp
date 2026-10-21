// Live updates used to run on a Socket.IO server here. They now go through Ably
// (see lib/realtime.js); this file keeps the old import path working.
const { getIo, onlineUserIds } = require('./lib/realtime');

/** Is this person online? Needs the couple, since presence lives on the couple channel. */
async function isOnline(userId, coupleId) {
  if (!coupleId) return false;
  return (await onlineUserIds(coupleId)).includes(String(userId));
}

module.exports = { getIo, isOnline };
