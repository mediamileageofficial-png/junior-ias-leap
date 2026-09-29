/* Public endpoint — receives the LEAP registration form and stores it in Supabase. */
const { sendRegistrationMail } = require('./_mail');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xtrqjkuydrjbgotrrann.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_5Q61PLjd1b9ytB-9WeEapw_iijMFVMN';
const CLASSES = ['Class 6th', 'Class 7th', 'Class 8th', 'Class 9th', 'Class 10th'];

function rpc(fn, args) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return Object.fromEntries(new URLSearchParams(req.body)); }
  }
  return {};
}

const field = (d, k, max = 255) => String(d[k] == null ? '' : d[k]).trim().slice(0, max);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const data = readBody(req);
  const r = {
    parent_name: field(data, 'parent_name', 120),
    child_name: field(data, 'child_name', 120),
    child_class: field(data, 'child_class', 20),
    mobile: field(data, 'mobile', 20).replace(/\D+/g, ''),
    whatsapp: field(data, 'whatsapp', 20).replace(/\D+/g, ''),
    email: field(data, 'email', 160),
    city: field(data, 'city', 120),
    source: field(data, 'source', 60),
    consent: !!data.consent && data.consent !== '0' && data.consent !== 'false',
  };

  // Bots that fill the hidden honeypot get a fake success and are not stored.
  if (field(data, 'website')) return res.status(200).json({ ok: true });

  const bad = [];
  if (r.parent_name.length < 2) bad.push('parent_name');
  if (r.child_name.length < 2) bad.push('child_name');
  if (!CLASSES.includes(r.child_class)) bad.push('child_class');
  if (!/^[6-9]\d{9}$/.test(r.mobile)) bad.push('mobile');
  if (r.whatsapp && !/^[6-9]\d{9}$/.test(r.whatsapp)) bad.push('whatsapp');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) bad.push('email'); // required — confirmation is e-mailed here
  if (bad.length) {
    return res.status(422).json({ ok: false, error: 'Please check the highlighted fields.', fields: bad });
  }

  let id;
  try {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const resp = await rpc('submit_registration', {
      p_parent_name: r.parent_name, p_child_name: r.child_name, p_child_class: r.child_class,
      p_mobile: r.mobile, p_whatsapp: r.whatsapp, p_email: r.email, p_city: r.city,
      p_source: r.source, p_consent: r.consent, p_ip: ip || null,
      p_user_agent: String(req.headers['user-agent'] || '').slice(0, 255),
    });
    if (!resp.ok) throw new Error(`Supabase ${resp.status}: ${await resp.text()}`);
    id = await resp.json();
  } catch (e) {
    console.error('[LEAP register]', e.message);
    return res.status(500).json({ ok: false, error: 'Could not save right now. Please try again, or WhatsApp us.' });
  }

  // Never let a mail problem fail the registration itself.
  let mail = 'failed';
  try { mail = await sendRegistrationMail(r); } catch (e) { console.error('[LEAP mail]', e.message); }
  try { await rpc('set_registration_mail_status', { p_id: id, p_status: mail }); } catch { /* optional */ }

  return res.status(200).json({ ok: true, id, mail });
};
