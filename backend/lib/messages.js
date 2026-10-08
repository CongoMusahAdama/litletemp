const Message = require('../models/Message');
const { presentMessage } = require('./present');
const { touchStreak } = require('./couple');

async function saveMessage(user, couple, body) {
  const type = ['text', 'voice', 'image', 'video'].includes(body.type) ? body.type : 'text';
  const text = body.text ? String(body.text).trim().slice(0, 4000) : '';
  const mediaUrl = body.mediaUrl ? String(body.mediaUrl).slice(0, 500) : '';
  if (type === 'text' && !text) {
    const error = new Error('Message cannot be empty');
    error.status = 400;
    throw error;
  }
  if (type !== 'text' && !mediaUrl) {
    const error = new Error('Media is required');
    error.status = 400;
    throw error;
  }
  const message = await Message.create({
    coupleId: couple._id,
    senderId: user._id,
    text: text || undefined,
    type,
    mediaUrl: mediaUrl || undefined,
    replyToId: body.replyToId || undefined,
  });
  const streak = await touchStreak(couple, user._id);
  const { getIo } = require('../socket');
  const io = getIo();
  if (io) {
    io.to(`couple:${couple._id}`).emit('message:new', presentMessage(message));
    io.to(`couple:${couple._id}`).emit('streak:updated', { streak });
  }
  const { notifyPartner } = require('./push');
  notifyPartner(user, couple, message).catch(() => undefined);
  return message;
}

module.exports = { saveMessage };
