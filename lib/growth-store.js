'use strict';

const { randomUUID } = require('crypto');

const SUPABASE_URL = 'https://qhqqlyvgtmekngnrtbel.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rzUUuLcv-HW8jiDVeqV52w_BfxAXaLg';

function clean(value, max = 300) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(/\s+/g, ' ');
  return text ? text.slice(0, max) : null;
}

function calculateCommercialScore(data) {
  const revenuePoints = {
    'Até R$ 20 mil': 5,
    'R$ 20 mil a R$ 50 mil': 10,
    'R$ 50 mil a R$ 100 mil': 16,
    'R$ 100 mil a R$ 300 mil': 22,
    'R$ 300 mil a R$ 1 milhão': 27,
    'Acima de R$ 1 milhão': 30
  };

  const result = data.result || {};
  const complexity = Math.max(0, Math.min(100, Number(result.complexity) || 0));
  const maturity = Math.max(0, Math.min(100, Number(result.maturity) || 0));
  const gaps = Array.isArray(result.gaps) ? result.gaps.length : 0;
  const needs = Array.isArray(data.needs) ? data.needs.length : 0;

  let score = revenuePoints[data.revenue] || 5;
  score += Math.round(complexity * 0.25);
  score += Math.min(20, gaps * 5);
  score += needs >= 8 ? 15 : needs >= 5 ? 10 : needs >= 3 ? 6 : 2;
  score += maturity >= 20 && maturity <= 70 ? 10 : maturity < 20 ? 5 : 3;

  return Math.max(0, Math.min(100, score));
}

function lifecycleFromScore(score) {
  if (score >= 80) return 'prioritario';
  if (score >= 60) return 'qualificado';
  if (score >= 35) return 'morno';
  return 'frio';
}

async function supabaseInsert(table, row) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(row)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`supabase_insert_failed:${response.status}`);
    error.detail = detail.slice(0, 500);
    throw error;
  }

  return null;
}

async function insertLead(data) {
  const result = data.result || {};
  const attribution = data.attribution || {};
  const score = calculateCommercialScore(data);

  const row = {
    id: randomUUID(),
    name: clean(data.name, 120),
    company: clean(data.company, 160),
    whatsapp: clean(data.whatsapp, 40),
    email: clean(data.email, 180),
    cnpj: clean(data.cnpj, 30),
    city: clean(data.city, 120),
    segment: clean(data.segment, 80),
    revenue: clean(data.revenue, 80),
    source: clean(attribution.source || attribution.utm_source || 'diagnostico', 80) || 'diagnostico',
    utm_source: clean(attribution.utm_source, 120),
    utm_medium: clean(attribution.utm_medium, 120),
    utm_campaign: clean(attribution.utm_campaign, 160),
    utm_content: clean(attribution.utm_content, 160),
    utm_term: clean(attribution.utm_term, 160),
    referrer: clean(attribution.referrer, 500),
    commercial_score: score,
    lifecycle_stage: lifecycleFromScore(score),
    recommended_plan: clean(result.recommendedPlan, 40),
    adherence: Number.isFinite(Number(result.adherence)) ? Number(result.adherence) : null,
    complexity: Number.isFinite(Number(result.complexity)) ? Number(result.complexity) : null,
    maturity: Number.isFinite(Number(result.maturity)) ? Number(result.maturity) : null,
    consent: Boolean(data.consent),
    payload: data
  };

  await supabaseInsert('growth_leads', row);
  return { id: row.id, score, lifecycleStage: row.lifecycle_stage };
}

async function insertEvent(event) {
  const allowed = new Set(['form_open','form_step','diagnostic_completed','whatsapp_click','site_click']);
  if (!allowed.has(event.eventName)) throw new Error('invalid_event_name');

  const attribution = event.attribution || {};
  const leadId = typeof event.leadId === 'string' && /^[0-9a-f-]{36}$/i.test(event.leadId) ? event.leadId : null;
  const row = {
    lead_id: leadId,
    session_id: clean(event.sessionId, 120),
    event_name: event.eventName,
    source: clean(attribution.source || attribution.utm_source || 'direct', 80),
    utm_source: clean(attribution.utm_source, 120),
    utm_medium: clean(attribution.utm_medium, 120),
    utm_campaign: clean(attribution.utm_campaign, 160),
    utm_content: clean(attribution.utm_content, 160),
    path: clean(event.path, 300),
    metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : {}
  };

  await supabaseInsert('growth_events', row);
}

module.exports = { insertLead, insertEvent, calculateCommercialScore, lifecycleFromScore };
