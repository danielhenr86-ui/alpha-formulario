'use strict';

const crypto = require('crypto');

function text(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function signatureValid(req, rawBody) {
  const secret = String(process.env.WHATSAPP_APP_SECRET || '').trim();
  if (!secret) return false;
  const signature = String(req.headers?.['x-hub-signature-256'] || '');
  if (!signature.startsWith('sha256=')) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function raw(req) {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 256 * 1024) throw new Error('payload_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query?.['hub.mode'];
    const token = req.query?.['hub.verify_token'];
    const challenge = req.query?.['hub.challenge'];
    const expected = String(process.env.WHATSAPP_VERIFY_TOKEN || '');

    if (mode === 'subscribe' && expected && token === expected) {
      return text(res, 200, String(challenge || ''));
    }
    return text(res, 403, 'verification_failed');
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const rawBody = await raw(req);
    if (!signatureValid(req, rawBody)) {
      return json(res, 401, { ok: false, error: 'invalid_signature' });
    }

    const payload = JSON.parse(rawBody);
    const entries = Array.isArray(payload.entry) ? payload.entry : [];

    for (const entry of entries) {
      for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
        const value = change?.value || {};
        const messages = Array.isArray(value.messages) ? value.messages : [];
        const statuses = Array.isArray(value.statuses) ? value.statuses : [];

        for (const message of messages) {
          console.log('WHATSAPP_INBOUND', {
            id: message.id,
            from: message.from,
            type: message.type,
            timestamp: message.timestamp
          });
        }

        for (const status of statuses) {
          console.log('WHATSAPP_STATUS', {
            id: status.id,
            status: status.status,
            recipientId: status.recipient_id,
            timestamp: status.timestamp
          });
        }
      }
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('whatsapp_webhook_failed', error?.message || error);
    return json(res, 400, { ok: false, error: 'invalid_webhook' });
  }
};
