const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM = 'dsmphotography21@gmail.com';
const SITE = 'https://dsmphotolab.com';
const LOGO = `${SITE}/assets/DSM_LOGOSaiFiles-01.png`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { to, subject, body: messageBody, attachments = [], emailType } = body;

  if (!to || !subject || !messageBody) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: to, subject, body' })
    };
  }

  // Build attachment links HTML
  let attachmentLinksHtml = '';
  if (attachments && attachments.length > 0) {
    const links = attachments.map(a =>
      `<div style="padding:6px 0;border-bottom:1px solid #f0ebe3;">
        <a href="${SITE}${a.path}" style="color:#C9A96E;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;text-decoration:none;">
          ↓ ${a.label}
        </a>
      </div>`
    ).join('');

    attachmentLinksHtml = `
      <div style="margin:24px 0 0;padding:16px 20px;background:#fdfaf6;border:1px solid #e8e0d4;">
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#9B9490;margin-bottom:10px;">Documents</div>
        ${links}
      </div>`;
  }

  // Convert plain text body to HTML paragraphs
  const bodyHtml = messageBody
    .split('\n')
    .map(line => line.trim() === '' ? '<br>' : `<p style="margin:0 0 10px;font-size:14px;line-height:1.75;color:#2C2C2C;">${line}</p>`)
    .join('');

  // Accent color by email type
  const accentColors = {
    invoice: '#C9A96E',
    deposit: '#8FBCB2',
    balance: '#4a8a4a'
  };
  const accent = accentColors[emailType] || '#C9A96E';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f0e8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border:1px solid #e8e0d4;">

        <!-- Header -->
        <tr>
          <td style="background:#1E1E1E;padding:28px 36px;text-align:center;border-bottom:2px solid ${accent};">
            <img src="${LOGO}" alt="DSM Photography" style="height:40px;width:auto;display:block;margin:0 auto;">
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px 24px;">
            <div style="font-family:'Helvetica Neue',Arial,sans-serif;">
              ${bodyHtml}
            </div>
            ${attachmentLinksHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#2C2C2C;padding:16px 36px;text-align:center;">
            <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#888;margin:0 0 4px;">DSM Photography · Miami, FL</p>
            <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#666;margin:0;">
              <a href="mailto:${FROM}" style="color:#C9A96E;text-decoration:none;">${FROM}</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await sgMail.send({
      to,
      from: FROM,
      subject,
      html,
      text: messageBody
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('SendGrid error:', JSON.stringify(err.response?.body || err.message));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.response?.body?.errors?.[0]?.message || err.message || 'Email send failed' })
    };
  }
};
