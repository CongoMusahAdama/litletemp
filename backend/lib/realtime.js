// Live updates through Ably (hosted realtime), replacing Socket.IO so the backend
// can run on Vercel, which can't hold connections open.
// Channels: `couple:<id>` (both partners) and `user:<id>` (one person).
const Ably = require('ably');
const { background } = require('./background');
const { log } = require('./log');

let rest = null;
let warned = false;

function ably() {
  if (!process.env.ABLY_API_KEY) {
    if (!warned) log('error', 'ABLY_API_KEY is missing: live updates are off');
    warned = true;
    return null;
  }
  if (!rest) rest = new Ably.Rest({ key: process.env.ABLY_API_KEY });
  return rest;
}

function publish(channel, event, data) {
  const client = ably();
  if (!client) return Promise.resolve();
  // Same JSON shape Socket.IO used to send (ObjectIds and Dates become strings).
  const payload = data === undefined ? null : JSON.parse(JSON.stringify(data));
  return background(
    client.channels.get(channel).publish(event, payload)
      .catch((error) => log('error', 'realtime publish failed', { channel, event, message: error.message })),
  );
}

/** Drop-in for the old Socket.IO server: getIo().to(room).emit(event, data). */
function getIo() {
  return {
    to(room) {
      return { emit: (event, data) => { publish(room, event, data); } };
    },
  };
}

/** Who in the couple has the app open right now (Ably presence). */
async function onlineUserIds(coupleId) {
  const client = ably();
  if (!client) return [];
  try {
    const page = await client.channels.get(`couple:${coupleId}`).presence.get();
    return page.items.map((member) => String(member.clientId));
  } catch {
    return [];
  }
}

/** A short-lived token so the phone can listen to its own couple and user channels only. */
async function tokenRequest(userId, coupleId) {
  const client = ably();
  if (!client) return null;
  const capability = {
    [`couple:${coupleId}`]: ['subscribe', 'publish', 'presence'],
    [`user:${userId}`]: ['subscribe'],
  };
  return client.auth.createTokenRequest({ clientId: String(userId), capability: JSON.stringify(capability) });
}

module.exports = { publish, getIo, onlineUserIds, tokenRequest };
