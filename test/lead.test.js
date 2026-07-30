'use strict';

const assert = require('node:assert/strict');
const { afterEach, beforeEach, test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const handler = require('../api/lead');

const originalFetch = global.fetch;
const originalWebhookUrl = process.env.LEAD_WEBHOOK_URL;
const originalWebhookToken = process.env.LEAD_WEBHOOK_BEARER_TOKEN;

function validLead(overrides = {}) {
  return {
    nome: 'Daniel Henrique',
    contato: 'daniel@example.com',
    pontuacao: 75,
    situacao: 'Organizado',
    consentimento_marketing: false,
    origem: 'diagnostico',
    empresa_website: '',
    ...overrides
  };
}

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(payload) {
      this.body = payload ? JSON.parse(payload) : null;
    }
  };
}

async function callHandler({
  method = 'POST',
  body = validLead(),
  headers = {},
  ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`
} = {}) {
  const req = {
    method,
    body,
    headers: {
      'content-type': 'application/json',
      host: 'meton-diagnostico.vercel.app',
      origin: 'https://meton-diagnostico.vercel.app',
      'x-forwarded-for': ip,
      ...headers
    },
    socket: {}
  };
  const res = createResponse();
  await handler(req, res);
  return res;
}

beforeEach(() => {
  handler._internals.resetRateLimits();
  process.env.LEAD_WEBHOOK_URL = 'https://example.test/leads';
  process.env.LEAD_WEBHOOK_BEARER_TOKEN = 'test-token';
});

afterEach(() => {
  global.fetch = originalFetch;

  if (originalWebhookUrl === undefined) delete process.env.LEAD_WEBHOOK_URL;
  else process.env.LEAD_WEBHOOK_URL = originalWebhookUrl;

  if (originalWebhookToken === undefined) delete process.env.LEAD_WEBHOOK_BEARER_TOKEN;
  else process.env.LEAD_WEBHOOK_BEARER_TOKEN = originalWebhookToken;
});

test('confirma sucesso somente depois que o destino aceita o lead', async () => {
  let deliveredRequest;
  global.fetch = async (url, options) => {
    deliveredRequest = { url, options };
    return { ok: true, status: 200 };
  };

  const res = await callHandler();

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(deliveredRequest.url, 'https://example.test/leads');
  assert.equal(deliveredRequest.options.headers.Authorization, 'Bearer test-token');

  const deliveredLead = JSON.parse(deliveredRequest.options.body);
  assert.equal(deliveredLead.nome, 'Daniel Henrique');
  assert.equal(deliveredLead.origem, 'diagnostico');
  assert.ok(deliveredLead.request_id);
  assert.ok(deliveredLead.enviado_em);
});

test('não aceita lead com contato inválido', async () => {
  global.fetch = async () => {
    throw new Error('fetch não deveria ser chamado');
  };

  const res = await callHandler({
    body: validLead({ contato: 'sem contato' })
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'invalid_lead');
  assert.ok(res.body.fields.includes('contato'));
});

test('bloqueia o campo honeypot preenchido por robô', async () => {
  global.fetch = async () => {
    throw new Error('fetch não deveria ser chamado');
  };

  const res = await callHandler({
    body: validLead({ empresa_website: 'https://spam.example' })
  });

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.fields.includes('anti_spam'));
});

test('propaga falha segura quando o destino rejeita a entrega', async () => {
  global.fetch = async () => ({ ok: false, status: 500 });

  const res = await callHandler();

  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, { ok: false, error: 'lead_delivery_failed' });
});

test('usa o Formspree da MetOn quando não há webhook personalizado', async () => {
  delete process.env.LEAD_WEBHOOK_URL;
  let deliveredRequest;
  global.fetch = async (url, options) => {
    deliveredRequest = { url, options };
    return { ok: true, status: 200 };
  };

  const res = await callHandler();

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(deliveredRequest.url, handler._internals.DEFAULT_LEAD_WEBHOOK_URL);
  assert.equal(deliveredRequest.options.headers.Accept, 'application/json');

  const deliveredLead = JSON.parse(deliveredRequest.options.body);
  assert.equal(deliveredLead._subject, 'Novo diagnóstico financeiro — MetOn');
  assert.equal(deliveredLead._replyto, 'daniel@example.com');
});

test('rejeita chamadas de outra origem', async () => {
  global.fetch = async () => {
    throw new Error('fetch não deveria ser chamado');
  };

  const res = await callHandler({
    headers: { origin: 'https://site-malicioso.example' }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'origin_not_allowed');
});

test('limita tentativas repetidas por origem', async () => {
  global.fetch = async () => ({ ok: true, status: 200 });
  const ip = '198.51.100.90';

  for (let index = 0; index < 5; index += 1) {
    const allowed = await callHandler({ ip });
    assert.equal(allowed.statusCode, 201);
  }

  const blocked = await callHandler({ ip });
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body.error, 'rate_limit_exceeded');
  assert.ok(Number(blocked.headers['retry-after']) > 0);
});

test('o cliente verifica response.ok antes de mostrar a tela de sucesso', () => {
  const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

  assert.match(html, /if \(!response\.ok \|\| !result \|\| result\.ok !== true\)/);
  assert.match(html, /catch \(err\)[\s\S]*errorEl\.style\.display = 'block'/);
  assert.match(html, /finally[\s\S]*btn\.disabled = false/);
});
