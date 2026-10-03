'use strict';

const nodemailer = require('nodemailer');
const { insertLead } = require('../lib/growth-store');

const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimitBuckets = new Map();

function getHeader(req,name){
  const headers=req.headers||{};
  const value=headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value)?value[0]:value;
}
function clientKey(req){
  const ff=getHeader(req,'x-forwarded-for');
  return (typeof ff==='string'&&ff.split(',')[0].trim()) || req.socket?.remoteAddress || 'unknown';
}
function sameOrigin(req){
  const origin=getHeader(req,'origin');
  if(!origin) return false;
  try{
    const hostname=new URL(origin).hostname.toLowerCase();
    return hostname==='formulario.metongestao.com.br'
      || hostname==='meton-diagnostico.vercel.app'
      || (hostname.startsWith('meton-diagnostico-')&&hostname.endsWith('.vercel.app'));
  }catch{return false}
}
function rateAllowed(key,now=Date.now()){
  const current=rateLimitBuckets.get(key);
  if(!current||current.resetAt<=now){rateLimitBuckets.set(key,{count:1,resetAt:now+RATE_LIMIT_WINDOW_MS});return true}
  if(current.count>=RATE_LIMIT_MAX_REQUESTS)return false;
  current.count+=1;return true;
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
  const chunks=[]; let size=0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('payload_too_large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function list(items) {
  return Array.isArray(items) && items.length
    ? '<ul>' + items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
    : '<p>Não informado.</p>';
}

function buildEmail(data) {
  const r=data.result||{};
  const c=r.coverage||{};
  const submittedAt=data.createdAt
    ? new Date(data.createdAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})
    : new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head>
  <body style="margin:0;background:#f6f8f7;font-family:Arial,sans-serif;color:#1D2939">
  <div style="max-width:760px;margin:0 auto;padding:28px 16px">
  <div style="background:#fff;border:1px solid #e4e7ec;border-radius:18px;overflow:hidden">
  <div style="padding:26px 30px;background:#062f25;color:white">
  <div style="font-size:22px;font-weight:800"><span style="color:#fff">Met</span><span style="color:#00B050">On</span> Gestão</div>
  <div style="margin-top:8px;color:#d9efe6">Novo Diagnóstico Inteligente recebido</div></div>
  <div style="padding:28px 30px">
  <h2 style="margin:0 0 6px">${esc(data.company||'Empresa não informada')}</h2>
  <p style="margin:0 0 24px;color:#667085">Enviado em ${esc(submittedAt)}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
  <tr><td style="padding:8px 0;color:#667085">Responsável</td><td style="padding:8px 0;font-weight:700">${esc(data.name)}</td></tr>
  <tr><td style="padding:8px 0;color:#667085">WhatsApp</td><td style="padding:8px 0;font-weight:700">${esc(data.whatsapp)}</td></tr>
  <tr><td style="padding:8px 0;color:#667085">E-mail</td><td style="padding:8px 0;font-weight:700">${esc(data.email)}</td></tr>
  <tr><td style="padding:8px 0;color:#667085">CNPJ</td><td style="padding:8px 0;font-weight:700">${esc(data.cnpj)}</td></tr>
  <tr><td style="padding:8px 0;color:#667085">Cidade/UF</td><td style="padding:8px 0;font-weight:700">${esc(data.city)}</td></tr>
  <tr><td style="padding:8px 0;color:#667085">Segmento</td><td style="padding:8px 0;font-weight:700">${esc(data.segment)}</td></tr>
  <tr><td style="padding:8px 0;color:#667085">Faturamento</td><td style="padding:8px 0;font-weight:700">${esc(data.revenue)}</td></tr>
  </table>
  <div style="margin:26px 0;padding:22px;border-radius:14px;background:#edf9f2;border:1px solid #b8e8cb">
  <div style="font-size:12px;font-weight:800;letter-spacing:1px;color:#006B3C">PLANO RECOMENDADO</div>
  <div style="font-size:34px;font-weight:900;margin:6px 0;color:#006B3C">${esc(r.recommendedPlan)}</div>
  <div><strong>${esc(r.adherence)}%</strong> de aderência · Complexidade ${esc(r.complexityLabel)} (${esc(r.complexity)}/100) · Maturidade ${esc(r.maturityLabel)} (${esc(r.maturity)}/100)</div>
  </div>
  <h3>Justificativa</h3><p style="line-height:1.6">${esc(r.reasoning)}</p>
  <h3>Aderência por plano</h3><p>Start: <strong>${esc(c.START)}%</strong> · Pro: <strong>${esc(c.PRO)}%</strong> · Business: <strong>${esc(c.BUSINESS)}%</strong></p>
  <h3>Principais necessidades</h3>${list(r.topNeeds)}
  <h3>Oportunidades de melhoria</h3>${list(r.gaps)}
  <h3>Dados operacionais</h3>
  <p style="line-height:1.7">Usuários: <strong>${esc(data.users)}</strong><br>
  Vendas/mês: <strong>${esc(data.salesPerMonth)}</strong><br>
  Notas/mês: <strong>${esc(data.invoicesPerMonth)}</strong><br>
  Produtos: <strong>${esc(data.productsCount)}</strong><br>
  Estoque: <strong>${data.hasStock?'Sim':'Não'}</strong><br>
  Mais de uma unidade: <strong>${data.multipleUnits?'Sim':'Não'}</strong><br>
  Equipe financeira: <strong>${data.financialTeam?'Sim':'Não'}</strong></p>
  <p style="margin-top:26px;color:#667085;font-size:12px">E-mail gerado automaticamente pelo Diagnóstico Inteligente MetOn Gestão.</p>
  </div></div></div></body></html>`;
}

module.exports = async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{ok:false,error:'method_not_allowed'});
  if(!sameOrigin(req)) return json(res,403,{ok:false,error:'origin_not_allowed'});
  if(!rateAllowed(clientKey(req))) return json(res,429,{ok:false,error:'rate_limit_exceeded'});
  const contentType=getHeader(req,'content-type')||'';
  if(!contentType.toLowerCase().includes('application/json')) return json(res,415,{ok:false,error:'content_type_not_supported'});
  try{
    const data=await readBody(req);
    if(!data?.result?.recommendedPlan) return json(res,400,{ok:false,error:'invalid_diagnostic'});

    let growth = { stored: false };
    try {
      const lead = await insertLead(data);
      growth = { stored: true, leadId: lead.id, score: lead.score, lifecycleStage: lead.lifecycleStage };
    } catch (storeError) {
      console.error('growth_lead_store_failed', storeError?.message || storeError);
    }

    const host=String(process.env.SMTP_HOST||'').trim();
    const port=Number(process.env.SMTP_PORT||465);
    const user=String(process.env.SMTP_USER||'').trim();
    const pass=process.env.SMTP_PASS;
    const from=String(process.env.SMTP_FROM||user).trim();
    const recipient='contato@metongestao.com.br';

    if(!host||!user||!pass||!from){
      console.error('smtp_not_configured');
      return json(res,503,{ok:false,error:'smtp_not_configured'});
    }

    const transporter=nodemailer.createTransport({
      host,
      port,
      secure:String(process.env.SMTP_SECURE??'true').toLowerCase()!=='false',
      auth:{user,pass}
    });

    await transporter.verify();

    const replyTo=typeof data.email==='string'&&data.email.includes('@')?data.email:undefined;
    const subjectCompany=(data.company||data.name||'Novo lead').toString().trim();

    const info=await transporter.sendMail({
      from:`MetOn Gestão <${from}>`,
      to:recipient,
      replyTo,
      subject:`Novo diagnóstico MetOn — ${subjectCompany} — ${data.result.recommendedPlan}`,
      html:buildEmail(data)
    });

    console.log('diagnostic_email_sent',{messageId:info.messageId,recipient});
    return json(res,201,{ok:true,...growth});
  }catch(err){
    console.error('diagnostic_email_failed',err?.message||err);
    return json(res,500,{ok:false,error:'email_delivery_failed'});
  }
};

