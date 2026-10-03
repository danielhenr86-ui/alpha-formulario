'use strict';

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
    digits = '55' + digits;
  }
  return /^\d{10,15}$/.test(digits) ? digits : null;
}

function config() {
  return {
    enabled: String(process.env.WHATSAPP_AUTOMATION_ENABLED || 'false').toLowerCase() === 'true',
    token: String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim(),
    phoneNumberId: String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(),
    graphVersion: String(process.env.WHATSAPP_GRAPH_VERSION || '').trim(),
    templateName: String(process.env.WHATSAPP_TEMPLATE_NAME || '').trim(),
    templateLanguage: String(process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR').trim()
  };
}

async function sendDiagnosticTemplate(data) {
  const cfg = config();
  if (!cfg.enabled) return { sent: false, reason: 'disabled' };
  if (!cfg.token || !cfg.phoneNumberId || !cfg.graphVersion || !cfg.templateName) {
    return { sent: false, reason: 'not_configured' };
  }

  const to = normalizePhone(data.whatsapp);
  if (!to) return { sent: false, reason: 'invalid_phone' };

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: cfg.templateName,
      language: { code: cfg.templateLanguage },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: String(data.name || 'Olá').slice(0, 120) },
          { type: 'text', text: String(data.company || 'sua empresa').slice(0, 160) },
          { type: 'text', text: String(data.result?.recommendedPlan || 'MetOn').slice(0, 80) }
        ]
      }]
    }
  };

  const response = await fetch(
    `https://graph.facebook.com/${cfg.graphVersion}/${cfg.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('whatsapp_send_failed:' + response.status);
    error.detail = result;
    throw error;
  }

  return {
    sent: true,
    messageId: result?.messages?.[0]?.id || null
  };
}

module.exports = { normalizePhone, sendDiagnosticTemplate };
