const crypto = require('crypto');

const UPLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function clock(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function uploadFilename(url) {
  const value = String(url || '');
  const at = value.indexOf('/uploads/');
  if (at < 0) return '';
  const name = decodeURIComponent(value.slice(at + '/uploads/'.length).split('?')[0].split('#')[0]);
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return '';
  return name;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Round the expiry up to a whole day so the same file gets the same link all day.
// A link that changed on every request made phones re-download every photo,
// avatar and voice note each time, which kept the server busy.
function signUpload(filename, now = Date.now()) {
  const exp = Math.ceil((now + UPLOAD_TTL_MS) / DAY_MS) * DAY_MS;
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${filename}.${exp}`).digest('hex');
  return `/uploads/${encodeURIComponent(filename)}?exp=${exp}&sig=${sig}`;
}

// New uploads live in Vercel Blob; their links are long random URLs on this host.
const BLOB_URL = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/[^?#\s]+$/i;

function blobUrl(url) {
  const value = String(url || '').split('?')[0].split('#')[0];
  return BLOB_URL.test(value) ? value : '';
}

function bareUpload(url) {
  const blob = blobUrl(url);
  if (blob) return blob;
  const filename = uploadFilename(url);
  if (!filename) return '';
  return `/uploads/${filename}`;
}

function publicMedia(url, now = Date.now()) {
  const blob = blobUrl(url);
  if (blob) return blob;
  const filename = uploadFilename(url);
  if (!filename) return String(url || '');
  if (!process.env.JWT_SECRET) return `/uploads/${encodeURIComponent(filename)}`;
  return signUpload(filename, now);
}

function verifyUpload(filename, exp, sig, now = Date.now()) {
  const safe = uploadFilename(`/uploads/${filename}`);
  const expNum = Number(exp);
  if (!safe || safe !== filename || !sig || !Number.isFinite(expNum) || expNum < now) return false;
  if (!process.env.JWT_SECRET) return false;
  const expected = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${safe}.${expNum}`).digest('hex');
  const left = Buffer.from(String(sig));
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function presentMessage(message) {
  const opened = message.viewOnce && message.viewedByPartner;
  return {
    id: message._id,
    senderId: message.senderId,
    text: message.isDeleted ? undefined : message.text,
    mediaUrl: (message.isDeleted || opened) ? undefined : publicMedia(message.mediaUrl),
    type: message.type,
    replyToId: message.replyToId || null,
    isDeleted: message.isDeleted,
    isEdited: message.isEdited,
    read: message.readByPartner,
    viewOnce: message.viewOnce || false,
    viewedByPartner: message.viewedByPartner || false,
    reactions: message.isDeleted ? [] : (message.reactions || []).map((item) => ({ userId: item.userId, emoji: item.emoji })),
    time: clock(message.createdAt),
    createdAt: message.createdAt,
  };
}

function presentCouple(couple, viewer) {
  if (!couple) return null;
  const partnerId = String(couple.partner1) === String(viewer._id) ? couple.partner2 : couple.partner1;
  const host = String(couple.partner1) === String(viewer._id);
  return {
    id: couple._id,
    inviteCode: couple.inviteCode,
    inviteExpiresAt: couple.inviteExpiresAt,
    status: couple.status,
    gatePassword: couple.status === 'pending' && host ? (couple.gatePassword || '') : '',
    expectedPartnerName: couple.expectedPartnerName || '',
    anniversary: couple.anniversary,
    currentStreak: couple.currentStreak,
    bestStreak: Math.max(couple.bestStreak || 0, couple.currentStreak || 0),
    wallpaperUrl: publicMedia(couple.wallpaperUrl || ''),
    partnerId: partnerId || null,
  };
}

function daysUntil(date) {
  if (!date) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - start) / 86400000);
}

module.exports = {
  dayKey,
  clock,
  presentMessage,
  presentCouple,
  daysUntil,
  publicMedia,
  bareUpload,
  uploadFilename,
  verifyUpload,
};
