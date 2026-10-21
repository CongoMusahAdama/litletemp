// Run the API on its own (local development). In production the same app runs
// inside the Next.js project on Vercel (src/pages/api/[...path].js), and live
// updates go through Ably instead of a socket server.
require('dotenv').config();
const http = require('http');
const { createApp } = require('./app');
const { getIo } = require('./socket');
const { connectDb } = require('./lib/db');
const { settleDueBets } = require('./lib/bets');
const { sendMorningNotes, sendAwayNotes } = require('./lib/morning');
const { log } = require('./lib/log');

if (!process.env.JWT_SECRET) {
  log('error', 'JWT_SECRET is missing');
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  log('error', 'MONGO_URI is missing');
  process.exit(1);
}

const app = createApp();
const server = http.createServer(app);

connectDb()
  .then(() => {
    log('info', 'Connected to MongoDB');
    const daily = () => {
      sendMorningNotes().catch((error) => log('error', 'morning notes failed', { stack: error.stack }));
      sendAwayNotes().catch((error) => log('error', 'away notes failed', { stack: error.stack }));
    };
    daily();
    setInterval(daily, 15 * 60 * 1000);
    setInterval(() => {
      settleDueBets(getIo()).catch((error) => log('error', 'bet settle failed', { stack: error.stack }));
    }, 5 * 60 * 1000);
  })
  .catch((error) => log('error', 'MongoDB connection error', { stack: error.stack }));

const PORT = process.env.PORT || 3005;
server.listen(PORT, '0.0.0.0', () => {
  log('info', `Little Temptation API listening on ${PORT}`);
});
