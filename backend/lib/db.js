// One MongoDB connection per server instance, opened on the first request.
// On Vercel each instance can serve many requests, so the connection is reused.
const mongoose = require('mongoose');

let pending = null;

function connectDb() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!process.env.MONGO_URI) return Promise.reject(new Error('MONGO_URI is not set'));
  if (!pending) {
    pending = mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
      .catch((error) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

module.exports = { connectDb };
