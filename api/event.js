'use strict';

const { insertEvent } = require('../lib/growth-store');

const MAX_BODY_BYTES = 16 * 1024;

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('payload_too_large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const body = await readBody(req);
    await insertEvent({
      eventName: body.eventName,
      sessionId: body.sessionId,
      path: body.path,
      attribution: body.attribution,
      metadata: body.metadata
    });
    return json(res, 201, { ok: true });
  } catch (error) {
    console.error('growth_event_failed', error?.message || error);
    return json(res, 400, { ok: false, error: 'event_not_recorded' });
  }
};
