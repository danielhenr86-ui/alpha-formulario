'use strict';

const { insertEvent } = require('../lib/growth-store');

const MAX_BODY_BYTES = 16 * 1024;

function getHeader(req,name){
  const headers=req.headers||{};
  const value=headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value)?value[0]:value;
}
function sameOrigin(req){
  const origin=getHeader(req,'origin');
  const host=getHeader(req,'x-forwarded-host')||getHeader(req,'host');
  if(!origin||!host) return false;
  try{return new URL(origin).host===host}catch{return false}
}

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
  if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'origin_not_allowed' });
  const contentType=getHeader(req,'content-type')||'';
  if(!contentType.toLowerCase().includes('application/json')) return json(res,415,{ok:false,error:'content_type_not_supported'});

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
