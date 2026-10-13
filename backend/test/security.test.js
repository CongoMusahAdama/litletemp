const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/unused';

const { publicMedia, verifyUpload } = require('../lib/present');
const { rateLimit } = require('../lib/limit');
const { createApp } = require('../app');

test('upload links are signed and expire', () => {
  const now = 1_700_000_000_000;
  const url = publicMedia('/uploads/photo.jpg', now);
  const parsed = new URL(url, 'http://local');
  assert.equal(verifyUpload('photo.jpg', parsed.searchParams.get('exp'), parsed.searchParams.get('sig'), now), true);
  assert.equal(verifyUpload('photo.jpg', parsed.searchParams.get('exp'), 'nope', now), false);
  assert.equal(verifyUpload('photo.jpg', parsed.searchParams.get('exp'), parsed.searchParams.get('sig'), now + 8 * 24 * 60 * 60 * 1000), false);
});

test('rate limit blocks the next request past the cap', () => {
  const limit = rateLimit({ windowMs: 60_000, max: 2 });
  const req = { headers: {}, ip: '10.0.0.8', socket: {} };
  let status = 0;
  const res = {
    set() {},
    status(code) { status = code; return this; },
    json() { return this; },
  };
  let passed = 0;
  limit(req, res, () => { passed += 1; });
  limit(req, res, () => { passed += 1; });
  limit(req, res, () => { passed += 1; });
  assert.equal(passed, 2);
  assert.equal(status, 429);
});

test('old pairing routes are closed', async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  try {
    const start = await fetch(`http://127.0.0.1:${port}/api/auth/start`, { method: 'POST' });
    const join = await fetch(`http://127.0.0.1:${port}/api/auth/join`, { method: 'POST' });
    assert.equal(start.status, 410);
    assert.equal(join.status, 410);
    const open = await fetch(`http://127.0.0.1:${port}/uploads/photo.jpg`);
    assert.equal(open.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
