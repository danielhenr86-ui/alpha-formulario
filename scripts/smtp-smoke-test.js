'use strict';
const nodemailer = require('nodemailer');

(async () => {
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE ?? 'true').toLowerCase() !== 'false';
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '');
  const from = String(process.env.SMTP_FROM || user).trim();
  const to = String(process.env.FORM_RECIPIENT || 'contato@metongestao.com.br').trim();

  if (!host || !user || !pass || !from || !to) {
    throw new Error('SMTP smoke test: missing required environment variables');
  }

  const transporter = nodemailer.createTransport({
    host, port, secure, auth: { user, pass }
  });

  await transporter.verify();
  const info = await transporter.sendMail({
    from: `MetOn Gestão <${from}>`,
    to,
    subject: '[TESTE SMTP] Diagnóstico MetOn via Vercel Preview',
    text: 'Teste real do SMTP do Diagnóstico MetOn executado durante a build do Preview no Vercel.'
  });

  console.log('SMTP_SMOKE_TEST_OK', info.messageId);
})().catch((err) => {
  console.error('SMTP_SMOKE_TEST_FAILED', err && err.message ? err.message : err);
  process.exit(1);
});
