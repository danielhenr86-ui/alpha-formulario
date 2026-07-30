'use strict';

const { randomUUID } = require('node:crypto');

const MAX_BODY_BYTES = 8 * 1024;
const DELIVERY_TIMEOUT_MS = 8_000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const ALLOWED_SITUATIONS = new Set(['Ponto crítico', 'Atenção', 'Organizado']);
const rateLimitBuckets = new Map();

function getHeader(req, name) {
  const headers = req.headers || {};
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  for (const [name, value] of Object.entries(extraHeaders)) {
    res.setHeader(name, value);
  }

  res.end(JSON.stringify(payload));
}

function normalizeText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function isValidContact(contact) {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const phoneDigits = contact.replace(/\D/g, '');
  const isPhone = phoneDigits.length >= 10 && phoneDigits.length <= 15;
  return isEmail || isPhone;
}

function validateLead(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, fields: ['body'] };
  }

  const lead = {
    nome: normalizeText(body.nome, 100),
    contato: normalizeText(body.contato, 160),
    pontuacao: Number(body.pontuacao),
    situacao: normalizeText(body.situacao, 40),
    consentimento_marketing: body.consentimento_marketing,
    origem: normalizeText(body.origem, 40),
    empresa_website: normalizeText(body.empresa_website, 200)
  };

  const invalidFields = [];
  if (lead.nome.length < 2) invalidFields.push('nome');
  if (!isValidContact(lead.contato)) invalidFields.push('contato');
  if (!Number.isInteger(lead.pontuacao) || lead.pontuacao < 0 || lead.pontuacao > 100) {
    invalidFields.push('pontuacao');
  }
  if (!ALLOWED_SITUATIONS.has(lead.situacao)) invalidFields.push('situacao');
  if (typeof lead.consentimento_marketing !== 'boolean') {
    invalidFields.push('consentimento_marketing');
  }
  if (lead.origem !== 'diagnostico') invalidFields.push('origem');
  if (lead.empresa_website) invalidFields.push('anti_spam');

  if (invalidFields.length > 0) {
    return { ok: false, fields: invalidFields };
  }

  delete lead.empresa_website;
  return { ok: true, lead };
}

function getClientKey(req) {
  const forwardedFor = getHeader(req, 'x-forwarded-for');
  const firstForwardedIp = typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0].trim()
    : '';

  return firstForwardedIp || req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(clientKey, now = Date.now()) {
  const current = rateLimitBuckets.get(clientKey);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(clientKey, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function isSameOrigin(req) {
  const origin = getHeader(req, 'origin');
  const host = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host');

  if (!origin || !host) return true;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    const serialized = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) {
      const error = new Error('payload_too_large');
      error.code = 'PAYLOAD_TOO_LARGE';
      throw error;
    }
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }

  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('payload_too_large');
      error.code = 'PAYLOAD_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function getWebhookUrl() {
  const configuredUrl = process.env.LEAD_WEBHOOK_URL;
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function deliverLead(lead, requestId) {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    const error = new Error('lead_webhook_not_configured');
    error.code = 'NOT_CONFIGURED';
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  const headers = {
    'Content-Type': 'application/json',
    'X-Meton-Source': 'diagnostico',
    'X-Request-Id': requestId
  };

  if (process.env.LEAD_WEBHOOK_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${process.env.LEAD_WEBHOOK_BEARER_TOKEN}`;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...lead,
        enviado_em: new Date().toISOString(),
        request_id: requestId
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const error = new Error('lead_webhook_rejected');
      error.code = 'UPSTREAM_REJECTED';
      error.status = response.status;
      throw error;
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function handler(req, res) {
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' }, {
      Allow: 'POST'
    });
  }

  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { ok: false, error: 'origin_not_allowed' });
  }

  const contentType = getHeader(req, 'content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return sendJson(res, 415, { ok: false, error: 'content_type_not_supported' });
  }

  const rateLimit = checkRateLimit(getClientKey(req));
  if (!rateLimit.allowed) {
    return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' }, {
      'Retry-After': String(rateLimit.retryAfterSeconds)
    });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    const statusCode = error.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
    return sendJson(res, statusCode, { ok: false, error: 'invalid_json' });
  }

  const validation = validateLead(body);
  if (!validation.ok) {
    return sendJson(res, 400, {
      ok: false,
      error: 'invalid_lead',
      fields: validation.fields
    });
  }

  try {
    await deliverLead(validation.lead, requestId);
    return sendJson(res, 201, { ok: true });
  } catch (error) {
    if (error.code === 'NOT_CONFIGURED') {
      console.error('lead_delivery_not_configured');
      return sendJson(res, 503, { ok: false, error: 'lead_service_unavailable' });
    }

    console.error('lead_delivery_failed', {
      code: error.code || error.name || 'unknown_error',
      upstream_status: error.status || null
    });
    return sendJson(res, 502, { ok: false, error: 'lead_delivery_failed' });
  }
}

module.exports = handler;
module.exports._internals = {
  checkRateLimit,
  validateLead,
  resetRateLimits: () => rateLimitBuckets.clear()
};
