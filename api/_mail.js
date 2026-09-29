/* LEAP e-mails: customer confirmation + admin alert, sent over SMTP (Gmail by default). */
const nodemailer = require('nodemailer');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function mailConfig() {
  const env = process.env;
  return {
    enabled: env.MAIL_ENABLED === 'true' && !!env.MAIL_USER && !!env.MAIL_PASS,
    host: env.MAIL_HOST || 'smtp.gmail.com',
    port: Number(env.MAIL_PORT || 465),
    secure: (env.MAIL_SECURE || 'ssl') === 'ssl',
    user: env.MAIL_USER,
    pass: env.MAIL_PASS,
    from: env.MAIL_FROM || env.MAIL_USER,
    fromName: env.MAIL_FROM_NAME || 'Junior IAS · LEAP',
    admin: env.MAIL_ADMIN || '',
    siteUrl: env.SITE_URL || '',
  };
}

function customerHtml(r) {
  const wa = 'https://wa.me/917708116991?text=LEAP';
  return `<!doctype html><html><body style="margin:0;background:#eef2fb;font-family:Segoe UI,Arial,sans-serif;color:#15223c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 14px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e9f4">
    <tr><td style="background:#0E2A5E;padding:22px 28px;color:#fff;font-size:18px;font-weight:700">
      Junior <span style="color:#F5811F">IAS</span> · LEAP
    </td></tr>
    <tr><td style="padding:28px">
      <p style="margin:0 0 14px;font-size:16px">Dear ${esc(r.parent_name)},</p>
      <p style="margin:0 0 16px;line-height:1.6">
        Thank you for registering <b>${esc(r.child_name)}</b> (${esc(r.child_class)}) for the <b>LEAP</b> first batch —
        Leadership · Excellence · Awareness · Purpose, a 1-year Leadership Discovery programme by Junior IAS.
      </p>
      <p style="margin:0 0 8px;font-weight:700;color:#0E2A5E">What happens next</p>
      <p style="margin:0 0 18px;line-height:1.6">
        Our WE4U IAS team will contact you shortly on WhatsApp and phone with the batch
        schedule, fee details and joining information. Seats are limited and confirmed
        in the order received.
      </p>
      <p style="margin:0 0 22px">
        <a href="${wa}" style="display:inline-block;background:#1E9E52;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">
          Message us on WhatsApp
        </a>
      </p>
      <p style="margin:0;color:#5b6a85;font-size:13px;line-height:1.6">
        If you didn't request this, you can ignore this email.
      </p>
    </td></tr>
    <tr><td style="background:#f4f6fb;padding:18px 28px;color:#5b6a85;font-size:12px;line-height:1.6">
      WE4U IAS Coaching Centre · Dream. Learn. Lead.<br>
      +91 77081 16991 · This is an automated confirmation.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function adminHtml(r, siteUrl) {
  const fields = {
    Parent: r.parent_name, Child: r.child_name, Class: r.child_class, Mobile: r.mobile,
    WhatsApp: r.whatsapp, Email: r.email, City: r.city, Source: r.source,
  };
  const rows = Object.entries(fields).map(([k, v]) => (
    `<tr><td style="padding:7px 12px;color:#5b6a85;border-bottom:1px solid #eef1f7;width:110px">${k}</td>` +
    `<td style="padding:7px 12px;border-bottom:1px solid #eef1f7;font-weight:600">${esc(v) || '<span style="color:#9aa7bf">—</span>'}</td></tr>`
  )).join('');
  const when = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const dash = siteUrl ? ` · <a href="${esc(siteUrl)}/admin/" style="color:#0E2A5E">Open dashboard</a>` : '';
  return `<!doctype html><html><body style="margin:0;background:#eef2fb;font-family:Segoe UI,Arial,sans-serif;color:#15223c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 14px">
  <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e9f4">
    <tr><td style="background:#E0342B;padding:16px 22px;color:#fff;font-weight:700">New LEAP registration</td></tr>
    <tr><td style="padding:14px 10px 4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}</table>
    </td></tr>
    <tr><td style="padding:12px 22px 20px;color:#5b6a85;font-size:12px">Received ${when}${dash}</td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/**
 * Sends the customer confirmation + admin notification.
 * Returns 'sent', 'sent_customer', 'sent_admin', 'failed' or 'disabled'.
 */
async function sendRegistrationMail(r) {
  const c = mailConfig();
  if (!c.enabled) return 'disabled';

  const transport = nodemailer.createTransport({
    host: c.host, port: c.port, secure: c.secure,
    auth: { user: c.user, pass: c.pass },
  });
  const from = { name: c.fromName, address: c.from };

  const jobs = [];
  if (r.email) {
    jobs.push(transport.sendMail({
      from, to: r.email, replyTo: c.admin || c.from,
      subject: "You're registered for the LEAP webinar batch — Junior IAS",
      html: customerHtml(r),
    }));
  } else {
    jobs.push(Promise.resolve(null));
  }
  if (c.admin) {
    jobs.push(transport.sendMail({
      from, to: c.admin, replyTo: r.email || c.from,
      subject: `New LEAP registration — ${r.parent_name} · ${r.child_class}`,
      html: adminHtml(r, c.siteUrl),
    }));
  } else {
    jobs.push(Promise.resolve(null));
  }

  const [cust, adm] = await Promise.allSettled(jobs);
  cust.status === 'rejected' && console.error('[LEAP mail:customer]', cust.reason && cust.reason.message);
  adm.status === 'rejected' && console.error('[LEAP mail:admin]', adm.reason && adm.reason.message);

  const okCustomer = r.email ? cust.status === 'fulfilled' : null;
  const okAdmin = c.admin ? adm.status === 'fulfilled' : null;
  if (okCustomer && okAdmin !== false) return 'sent';
  if (okCustomer) return 'sent_customer';
  if (okAdmin) return 'sent_admin';
  return 'failed';
}

module.exports = { sendRegistrationMail };
