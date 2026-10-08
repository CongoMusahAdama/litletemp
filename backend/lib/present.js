function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function clock(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function presentMessage(message) {
  return {
    id: message._id,
    senderId: message.senderId,
    text: message.isDeleted ? undefined : message.text,
    mediaUrl: message.isDeleted ? undefined : message.mediaUrl,
    type: message.type,
    replyToId: message.replyToId || null,
    isDeleted: message.isDeleted,
    isEdited: message.isEdited,
    read: message.readByPartner,
    time: clock(message.createdAt),
    createdAt: message.createdAt,
  };
}

function presentCouple(couple, viewer) {
  if (!couple) return null;
  const partnerId = String(couple.partner1) === String(viewer._id) ? couple.partner2 : couple.partner1;
  return {
    id: couple._id,
    inviteCode: couple.inviteCode,
    inviteExpiresAt: couple.inviteExpiresAt,
    status: couple.status,
    expectedPartnerName: couple.expectedPartnerName || '',
    anniversary: couple.anniversary,
    currentStreak: couple.currentStreak,
    wallpaperUrl: couple.wallpaperUrl || '',
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

module.exports = { dayKey, clock, presentMessage, presentCouple, daysUntil };
