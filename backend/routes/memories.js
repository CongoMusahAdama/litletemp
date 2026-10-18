const express = require('express');
const JournalEntry = require('../models/JournalEntry');
const Message = require('../models/Message');
const DailyAnswer = require('../models/DailyAnswer');
const Snap = require('../models/Snap');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { publicMedia, dayKey } = require('../lib/present');

const router = express.Router();
router.use(requireAuth, requireCouple);

const LOOKBACKS = [
  { months: 1, label: '1 month ago today' },
  { months: 3, label: '3 months ago today' },
  { months: 6, label: '6 months ago today' },
  { months: 12, label: '1 year ago today' },
  { months: 24, label: '2 years ago today' },
  { months: 36, label: '3 years ago today' },
  { months: 60, label: '5 years ago today' },
];

// The viewer's local calendar day, shifted back N months. Days that do not
// exist in the target month (e.g. 31 Feb) are skipped.
function windowFor(offsetMinutes, months) {
  const local = new Date(Date.now() - offsetMinutes * 60000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() - months;
  const d = local.getUTCDate();
  const start = new Date(Date.UTC(y, m, d));
  if (start.getUTCDate() !== d) return null;
  const from = new Date(start.getTime() + offsetMinutes * 60000);
  const to = new Date(from.getTime() + 86400000);
  return { from, to, day: dayKey(start) };
}

router.get('/', async (req, res, next) => {
  try {
    const offset = Math.max(-840, Math.min(840, Number(req.query.offset) || 0));
    const me = String(req.user._id);
    const memories = [];

    for (const look of LOOKBACKS) {
      const range = windowFor(offset, look.months);
      if (!range) continue;
      if (range.to <= req.couple.createdAt) break;
      const created = { $gte: range.from, $lt: range.to };
      const [entries, photos, answers, snaps] = await Promise.all([
        JournalEntry.find({ coupleId: req.couple._id, createdAt: created }).sort({ createdAt: 1 }).limit(6),
        Message.find({
          coupleId: req.couple._id,
          createdAt: created,
          type: 'image',
          isDeleted: false,
          viewOnce: { $ne: true },
          mediaUrl: { $exists: true, $ne: '' },
        }).sort({ createdAt: 1 }).limit(6),
        DailyAnswer.find({ coupleId: req.couple._id, day: range.day }),
        Snap.find({ coupleId: req.couple._id, authorId: req.user._id, createdAt: created }).sort({ createdAt: 1 }).limit(6),
      ]);

      snaps.forEach((snap) => {
        memories.push({
          id: `snap-${snap._id}`,
          kind: 'snap',
          label: look.label,
          title: 'A snap you saved',
          text: '',
          mediaUrl: publicMedia(snap.mediaUrl),
          mediaType: 'image',
          date: snap.createdAt,
        });
      });

      entries.forEach((entry) => {
        const media = (entry.media || []).find((item) => item.type === 'image') || (entry.media || [])[0];
        memories.push({
          id: `journal-${entry._id}`,
          kind: 'journal',
          label: look.label,
          title: entry.title,
          text: entry.text || '',
          mediaUrl: media ? publicMedia(media.url) : '',
          mediaType: media ? media.type : '',
          date: entry.createdAt,
        });
      });
      photos.forEach((photo) => {
        memories.push({
          id: `photo-${photo._id}`,
          kind: 'photo',
          label: look.label,
          title: String(photo.senderId) === me ? 'A photo you sent' : 'A photo they sent you',
          text: '',
          mediaUrl: publicMedia(photo.mediaUrl),
          mediaType: 'image',
          date: photo.createdAt,
        });
      });
      if (answers.length > 1) {
        const mine = answers.find((item) => String(item.userId) === me);
        const theirs = answers.find((item) => String(item.userId) !== me);
        memories.push({
          id: `answer-${range.day}`,
          kind: 'answer',
          label: look.label,
          title: answers[0].question,
          text: `You: ${mine?.text || ''}\nThem: ${theirs?.text || ''}`,
          mediaUrl: '',
          mediaType: '',
          date: answers[0].createdAt,
        });
      }
    }

    res.json(memories);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
