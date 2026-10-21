// On Vercel a function is frozen as soon as the response is sent, which would cut
// off push notifications and live updates mid-flight. waitUntil keeps it alive
// until they finish. Outside Vercel (local dev) the promise simply runs.
let waitUntil = null;
try {
  ({ waitUntil } = require('@vercel/functions'));
} catch {
  waitUntil = null;
}

function background(promise) {
  const safe = Promise.resolve(promise).catch(() => undefined);
  try {
    if (waitUntil) waitUntil(safe);
  } catch {
    // Not inside a Vercel request (e.g. local server): nothing to extend.
  }
  return safe;
}

module.exports = { background };
