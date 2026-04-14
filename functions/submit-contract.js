const { createClient } = require('@supabase/supabase-js');
const sgMail = require('@sendgrid/mail');

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const CONTRACT_LABELS = {
  master: 'Master Services Agreement',
  event: 'Event Coverage Addendum',
  portrait: 'Portrait Session Addendum'
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const {
    portal_token,
    booking_id,
    contract_type,   // 'master' | 'event' | 'portrait'
    client_name,
    client_email,
    signed_name,
    form_data        // object with all filled fields
  } = body;

  if (!portal_token || !booking_id || !contract_type || !signed_name || !client_email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const signed_at = new Date().toISOString();
  const supabase = getSupabase();

  // Check if already signed
  const { data: existing } = await supabase
    .from('contracts')
    .select('id')
    .eq('booking_id', booking_id)
    .eq('contract_type', contract_type)
    .maybeSingle();

  if (existing) {
    return { statusCode: 409, body: JSON.stringify({ error: 'Contract already signed.' }) };
  }

  // Save to Supabase
  const { data: contract, error: insertError } = await supabase
    .from('contracts')
    .insert([{
      booking_id,
      portal_token,
      contract_type,
      client_name,
      client_email,
      signed_name,
      signed_at,
      form_data,
      status: 'signed'
    }])
    .select()
    .single();

  if (insertError) {
    return { statusCode: 500, body: JSON.stringify({ error: insertError.message }) };
  }

  const label = CONTRACT_LABELS[contract_type] || contract_type;

  // Build form data summary HTML
  const formRows = Object.entries(form_data || {})
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#888;font-size:12px;white-space:nowrap;">${k}</td><td style="padding:4px 0;font-size:12px;color:#222;">${v || '—'}</td></tr>`)
    .join('');

  const logoUrl = 'https://dsmphotolab.com/assets/DSM_LOGOSaiFiles-01.png';

  // Email to Dayna
  const adminHtml = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:580px;margin:0 auto;background:#1a1812;border-radius:4px;overflow:hidden;">
      <div style="background:#1a1812;padding:28px 32px;border-bottom:1px solid #C9A96E44;text-align:center;">
        <img src="${logoUrl}" alt="DSM Photography" style="height:44px;width:auto;">
      </div>
      <div style="padding:28px 32px;background:#1a1812;color:white;">
        <p style="font-family:'Georgia',serif;font-size:20px;font-weight:300;color:#C9A96E;margin:0 0 6px;">Contract Signed</p>
        <p style="font-size:13px;color:rgba(255,255,255,0.6);margin:0 0 24px;">A client has signed their ${label}.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:4px 12px 4px 0;color:#888;font-size:12px;">Client</td><td style="font-size:12px;color:#fff;">${client_name}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#888;font-size:12px;">Email</td><td style="font-size:12px;color:#fff;">${client_email}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#888;font-size:12px;">Document</td><td style="font-size:12px;color:#C9A96E;">${label}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#888;font-size:12px;">Signed As</td><td style="font-size:12px;color:#fff;">${signed_name}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#888;font-size:12px;">Signed At</td><td style="font-size:12px;color:#fff;">${new Date(signed_at).toLocaleString('en-US',{timeZone:'America/New_York'})}</td></tr>
        </table>
        ${formRows ? `<p style="font-size:11px;color:#888;margin:0 0 8px;letter-spacing:0.1em;text-transform:uppercase;">Form Fields</p><table style="width:100%;border-collapse:collapse;">${formRows}</table>` : ''}
      </div>
      <div style="padding:16px 32px;background:#111;text-align:center;font-size:10px;color:#555;letter-spacing:0.1em;text-transform:uppercase;">DSM Photography · Miami, FL</div>
    </div>`;

  // Confirmation email to client
  const clientHtml = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:580px;margin:0 auto;background:#FDFAF6;border-radius:4px;overflow:hidden;">
      <div style="background:#1a1812;padding:28px 32px;text-align:center;">
        <img src="${logoUrl}" alt="DSM Photography" style="height:44px;width:auto;">
      </div>
      <div style="padding:32px 32px;background:#FDFAF6;">
        <p style="font-family:'Georgia',serif;font-size:22px;font-weight:300;color:#2C2C2C;margin:0 0 8px;">You're all signed, ${client_name.split(' ')[0]}.</p>
        <p style="font-size:13px;color:#6B6560;margin:0 0 24px;line-height:1.7;">Your <strong style="color:#2C2C2C;">${label}</strong> has been received and recorded. A copy of your submission details is below for your records.</p>
        <div style="background:white;border:1px solid #e8e0d4;padding:16px 20px;margin-bottom:24px;">
          <p style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#9B9490;margin:0 0 12px;">Signature Record</p>
          <p style="font-size:13px;color:#2C2C2C;margin:0 0 4px;"><strong>Signed as:</strong> ${signed_name}</p>
          <p style="font-size:12px;color:#6B6560;margin:0;">${new Date(signed_at).toLocaleString('en-US',{timeZone:'America/New_York'})}</p>
        </div>
        <p style="font-size:13px;color:#6B6560;line-height:1.7;margin:0;">If you have any questions, reply to this email or reach out at <a href="mailto:dsmphotography21@gmail.com" style="color:#C9A96E;">dsmphotography21@gmail.com</a>.</p>
      </div>
      <div style="padding:16px 32px;background:#2C2C2C;text-align:center;font-size:10px;color:#888;letter-spacing:0.1em;text-transform:uppercase;">DSM Photography · Miami, FL · dsmphotography21@gmail.com</div>
    </div>`;

  try {
    await sgMail.send([
      {
        to: 'dsmphotography21@gmail.com',
        from: 'dsmphotography21@gmail.com',
        subject: `[DSM] Contract Signed — ${label} — ${client_name}`,
        html: adminHtml
      },
      {
        to: client_email,
        from: 'dsmphotography21@gmail.com',
        subject: `Your DSM Photography ${label} — Signed`,
        html: clientHtml
      }
    ]);
  } catch (emailErr) {
    console.error('SendGrid error:', emailErr.response?.body || emailErr.message);
    // Don't fail the whole request if email fails — contract is saved
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, contract_id: contract.id, signed_at })
  };
};
