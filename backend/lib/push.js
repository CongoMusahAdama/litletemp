const webpush = require('web-push');
const mongoose = require('mongoose');

const keySchema = new mongoose.Schema({
  publicKey: { type: String, required: true },
  privateKey: { type: String, required: true },
});

const PushKey = mongoose.models.PushKey || mongoose.model('PushKey', keySchema);

async function vapidPublicKey() {
  let key = await PushKey.findOne();
  if (!key) {
    const generated = webpush.generateVAPIDKeys();
    key = await PushKey.create(generated);
  }
  webpush.setVapidDetails('mailto:hello@littletemptation.app', key.publicKey, key.privateKey);
  return key.publicKey;
}

async function notifyPartner(sender, couple, message) {
  const User = require('../models/User');
  const Message = require('../models/Message');
  const partnerId = [couple.partner1, couple.partner2]
    .map((id) => (id ? String(id) : ''))
    .find((id) => id && id !== String(sender._id));
  if (!partnerId) return;
  const partner = await User.findById(partnerId);
  if (!partner || partner.notifications === false || !partner.pushSubscriptions?.length) return;
  await vapidPublicKey();
  const unread = await Message.countDocuments({
    coupleId: couple._id,
    senderId: sender._id,
    readByPartner: false,
    isDeleted: false,
  });
  const preview = message.type === 'text'
    ? (message.text || 'New message')
    : message.type === 'image'
      ? 'Sent a photo'
      : message.type === 'video'
        ? 'Sent a video'
        : 'Sent a voice note';
  const icon = sender.avatarUrl
    ? (String(sender.avatarUrl).startsWith('http')
      ? sender.avatarUrl
      : `${process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_API_URL || ''}${sender.avatarUrl}`)
    : '';
  const payload = JSON.stringify({
    unread,
    title: sender.username || sender.name || 'Little Temptation',
    body: String(preview).slice(0, 140),
    icon,
  });
  const remaining = [];
  for (const sub of partner.pushSubscriptions) {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, payload);
      remaining.push(sub);
    } catch (error) {
      if (error.statusCode !== 404 && error.statusCode !== 410) remaining.push(sub);
    }
  }
  if (remaining.length !== partner.pushSubscriptions.length) {
    partner.pushSubscriptions = remaining;
    await partner.save();
  }
}

module.exports = { vapidPublicKey, notifyPartner };
