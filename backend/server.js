require('dotenv').config();
const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const meRoutes = require('./routes/me');
const chatRoutes = require('./routes/chat');
const journalRoutes = require('./routes/journal');
const moodRoutes = require('./routes/mood');
const wishlistRoutes = require('./routes/wishlist');
const bucketRoutes = require('./routes/bucket');
const storyRoutes = require('./routes/stories');
const uploadRoutes = require('./routes/uploads');
const pushRoutes = require('./routes/push');
const { initSocket } = require('./socket');
const { sendMorningNotes } = require('./lib/morning');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Add it to backend/.env before starting.');
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is missing. Add it to backend/.env before starting.');
  process.exit(1);
}

const clientOrigin = process.env.CLIENT_ORIGIN || '*';
const allowedOrigins = clientOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);

const app = express();
app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
}));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'up' : 'down' });
});

app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/moods', moodRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/bucket', bucketRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/push', pushRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File is larger than 25MB' });
  }
  res.status(500).json({ error: 'Something went wrong' });
});

const server = http.createServer(app);
initSocket(server);

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const users = mongoose.connection.collection('users');
    const indexes = await users.indexes();
    if (indexes.some((index) => index.name === 'email_1')) {
      await users.dropIndex('email_1');
    }
    console.log('Connected to MongoDB');
    sendMorningNotes().catch(() => undefined);
    setInterval(() => sendMorningNotes().catch(() => undefined), 15 * 60 * 1000);
  })
  .catch((error) => console.error('MongoDB connection error:', error.message));

const PORT = process.env.PORT || 3005;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Little Temptation API listening on ${PORT}`);
});
