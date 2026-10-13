require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const { createApp } = require('./app');
const { initSocket } = require('./socket');
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
initSocket(server);

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const users = mongoose.connection.collection('users');
    const indexes = await users.indexes();
    if (indexes.some((index) => index.name === 'email_1')) {
      await users.dropIndex('email_1');
    }
    log('info', 'Connected to MongoDB');
    sendMorningNotes().catch((error) => log('error', 'morning notes failed', { stack: error.stack }));
    sendAwayNotes().catch((error) => log('error', 'away notes failed', { stack: error.stack }));
    setInterval(() => {
      sendMorningNotes().catch((error) => log('error', 'morning notes failed', { stack: error.stack }));
      sendAwayNotes().catch((error) => log('error', 'away notes failed', { stack: error.stack }));
    }, 15 * 60 * 1000);
  })
  .catch((error) => log('error', 'MongoDB connection error', { stack: error.stack }));

const PORT = process.env.PORT || 3005;
server.listen(PORT, '0.0.0.0', () => {
  log('info', `Little Temptation API listening on ${PORT}`);
});
