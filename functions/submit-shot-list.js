const { createClient } = require('@supabase/supabase-js');
const sgMail = require('@sendgrid/mail');

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
    client_name,
    client_email,
    session_date,
    form_data   // full shot list data object
  } = body;

  if (!portal_token || !booking_id || !client_name) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const submitted_at = new Date().toISOString();
  const supabase = getSupabase();

  // Upsert — allow resubmission
  const { data: shotList, error } = await supabase
    .from('shot_lists')
    .upsert([{
      booking_id,
      portal_token,
      client_name,
      session_date,
      submitted_at,
      raw_data: form_data,
      // Map common fields for easy querying
      must_have_shots: form_data?.must_have_moments || '',
      people_to_include: form_data?.people_to_capture || '',
      special_moments: form_data?.nice_to_have_moments || '',
      additional_notes: form_data?.anything_else || ''
    }], { onConflict: 'booking_id' })
    .select()
    .single();

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  const logoUrl = 'https://dsmphotolab.com/assets/DSM_LOGOSaiFiles-01.png';

  // Build summary rows for email
  const summaryFields = [
    ['Event / Session', form_data?.event_name || form_data?.session_name],
    ['Date', form_data?.event_date || session_date],
    ['Venue', form_data?.venue],
    ['Package', form_data?.package],
    ['Mood / Vibe', form_data?.mood_vibe],
    ['Priorities', form_data?.priorities],
    ['Must-Have Moments', form_data?.must_have_moments],
    ['Nice-to-Have', form_data?.nice_to_have_moments],
    ['People to Capture', form_data?.people_to_capture],
    ['Group Photos', form_data?.group_photos],
    ['Timeline', form_data?.event_timeline],
    ['Accessibility Notes', form_data?.accessibility_notes],
    ['Anything Else', form_data?.anything_else],
  ].filter(([, v]) => v);

  const rows = summaryFields.map(([k, v]) =>
    `<tr><td style="padding:5px 14px 5px 0;color:#888;font-size:11px;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:5px 0;font-size:12px;color:#eee;vertical-align:top;">${String(v).replace(/\n/g,'<br>')}</td></tr>`
  ).join('');

  const adminHtml = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1812;border-radius:4px;overflow:hidden;">
      <div style="background:#1a1812;padding:24px 32px;border-bottom:1px solid #C9A96E44;text-align:center;">
        <img src="${logoUrl}" alt="DSM Photography" style="height:40px;width:auto;">
      </div>
      <div style="padding:28px 32px;">
        <p style="font-family:'Georgia',serif;font-size:20px;font-weight:300;color:#C9A96E;margin:0 0 6px;">Shot List Received</p>
        <p style="font-size:13px;color:rgba(255,255,255,0.5);margin:0 0 24px;">${client_name} · ${session_date || 'Date TBD'}</p>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </div>
      <div style="padding:14px 32px;background:#111;text-align:center;font-size:10px;color:#555;letter-spacing:0.1em;text-transform:uppercase;">DSM Photography · Miami, FL</div>
    </div>`;

  const clientHtml = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:580px;margin:0 auto;background:#FDFAF6;border-radius:4px;overflow:hidden;">
      <div style="background:#1a1812;padding:24px 32px;text-align:center;">
        <img src="${logoUrl}" alt="DSM Photography" style="height:40px;width:auto;">
      </div>
      <div style="padding:32px;">
        <p style="font-family:'Georgia',serif;font-size:22px;font-weight:300;color:#2C2C2C;margin:0 0 8px;">Shot list received!</p>
        <p style="font-size:13px;color:#6B6560;margin:0 0 20px;line-height:1.7;">Your shot list has been submitted and I'll review it carefully before your session. You'll hear from me 48 hours before your date to confirm everything.</p>
        <p style="font-size:13px;color:#6B6560;">— Dayna · DSM Photography</p>
      </div>
      <div style="padding:14px 32px;background:#2C2C2C;text-align:center;font-size:10px;color:#888;letter-spacing:0.1em;text-transform:uppercase;">DSM Photography · Miami, FL</div>
    </div>`;

  try {
    const emails = [{
      to: 'dsmphotography21@gmail.com',
      from: 'dsmphotography21@gmail.com',
      subject: `[DSM] Shot List — ${client_name} · ${session_date || 'Date TBD'}`,
      html: adminHtml
    }];
    if (client_email) {
      emails.push({
        to: client_email,
        from: 'dsmphotography21@gmail.com',
        subject: 'Your DSM Photography Shot List — Received',
        html: clientHtml
      });
    }
    await sgMail.send(emails);
  } catch (emailErr) {
    console.error('SendGrid error:', emailErr.response?.body || emailErr.message);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, shot_list_id: shotList.id, submitted_at })
  };
};
