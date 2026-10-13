function log(level, message, extra = {}) {
  const payload = {
    time: new Date().toISOString(),
    level,
    message,
  };
  if (extra.code) payload.code = extra.code;
  if (extra.status) payload.status = extra.status;
  if (extra.path) payload.path = extra.path;
  if (level === 'error' && extra.stack) payload.stack = String(extra.stack).split('\n').slice(0, 6).join('\n');
  console.log(JSON.stringify(payload));
}

module.exports = { log };
