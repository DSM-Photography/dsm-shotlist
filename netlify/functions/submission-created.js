// Netlify Function: submission-created
// Triggers automatically on every Netlify form submission
// Sends PDF to photographer + confirmation to client

const https = require('https');

// ── Sendgrid helper ──────────────────────────────────────
function sendEmail(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'api.sendgrid.com',
      path: '/v3/mail/send',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.SENDGRID_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode });
        } else {
          reject(new Error('SendGrid error ' + res.statusCode + ': ' + data));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Build print HTML (mirrors the client-side doPrint) ───
function buildPrintHTML(f) {
  const gold = '#c8a870';
  const parch = '#faf7f2';

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function sh(title, sub) {
    return `<div class="sh"><span class="sh-title">${esc(title)}</span>${sub ? `<span class="sh-sub">${esc(sub)}</span>` : ''}</div>`;
  }
  function field(label, val) {
    if (!val || val === '—') return `<div class="fb"><div class="lbl">${esc(label)}</div><div class="val">—</div></div>`;
    return `<div class="fb"><div class="lbl">${esc(label)}</div><div class="val">${esc(val)}</div></div>`;
  }
  function row2(a, b) {
    return `<div class="row2">${a}${b}</div>`;
  }
  function fullField(label, val) {
    if (!val) return '';
    return `<div class="fb full"><div class="lbl">${esc(label)}</div><div class="val">${esc(val)}</div></div>`;
  }

  // Parse serialized list fields (newline separated)
  function parseList(str) {
    if (!str || str === 'None') return [];
    return str.split('\n').filter(Boolean);
  }

  function checkList(items, emptyMsg) {
    if (!items.length) return `<div class="empty">${emptyMsg}</div>`;
    return items.map((item, i) => {
      const shade = i % 2 === 1 ? ' shade' : '';
      // item format: "1. [VIP] Moment | Time: 5pm | Who: Name | Notes: ..."
      const parts = item.split(' | ');
      const main = parts[0] || '';
      const isVip = main.includes('[VIP]');
      const desc = main.replace(/^\d+\.\s*\[VIP\]\s*/, '').replace(/^\d+\.\s*/, '');
      const meta = parts.slice(1);
      return `<div class="check-row${shade}">
        <div class="cb-col"><span class="checkbox"></span></div>
        <div class="desc-col">
          <span class="desc-main">${esc(desc)}</span>
          ${isVip ? '<span class="vip-badge">★ VIP</span>' : ''}
          ${meta.map(m => `<span class="meta">${esc(m)}</span>`).join('')}
        </div>
      </div>`;
    }).join('');
  }

  function chipRow(str) {
    if (!str) return '<div class="empty">Not specified.</div>';
    return `<div class="chips">${str.split(', ').map(c => `<span class="chip">${esc(c)}</span>`).join('')}</div>`;
  }

  function priGrid(str) {
    const all = ['Candid Moments','Formal Documentation','Guest Interactions','Branding & Org. Presence','Posed Portraits','Venue & Décor Details','Speeches & Presentations','Dancing & Celebration'];
    const selected = str ? str.split(', ') : [];
    return `<div class="pri-grid">${all.map(p => {
      const on = selected.some(s => s.toLowerCase() === p.toLowerCase());
      return `<div class="pi${on?' pi-on':''}">${esc(p)}</div>`;
    }).join('')}</div>`;
  }

  const fmtDate = (s) => {
    if (!s) return '—';
    const p = s.split('-');
    return p.length === 3 ? `${p[1]}/${p[2]}/${p[0]}` : s;
  };

  const css = `
    @page { margin: .65in .65in .9in; size: letter; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; font-size: 9.5pt; color: #1c1a18; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .doc-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 9pt; border-bottom: 1.5pt solid ${gold}; margin-bottom: 14pt; }
    .dh-right { text-align: right; }
    .dh-title { font-size: 15pt; letter-spacing: .22em; text-transform: uppercase; color: ${gold}; font-family: Arial, sans-serif; font-weight: 700; }
    .dh-event { font-style: italic; font-size: 12pt; color: #3a3630; margin-top: 2pt; }
    .dh-meta { font-size: 7pt; letter-spacing: .1em; color: #aaa; margin-top: 3pt; font-family: Arial, sans-serif; }
    .dh-stamp { font-size: 6.5pt; color: ${gold}; margin-top: 4pt; border-top: .5pt solid #e4ddd2; padding-top: 4pt; font-family: Arial, sans-serif; letter-spacing: .1em; }
    .sh { background: #f5ede0; border-left: 2.5pt solid ${gold}; padding: 5pt 10pt; margin: 12pt 0 6pt; }
    .sh-title { display: block; font-family: Arial, sans-serif; font-size: 7pt; letter-spacing: .22em; text-transform: uppercase; color: #9a7030; font-weight: 700; }
    .sh-sub { display: block; font-style: italic; font-size: 8.5pt; color: #a07840; margin-top: 2pt; letter-spacing: 0; text-transform: none; }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; margin-bottom: 4pt; }
    .fb { margin-bottom: 5pt; }
    .fb.full { grid-column: 1/-1; }
    .lbl { font-family: Arial, sans-serif; font-size: 6.5pt; letter-spacing: .18em; text-transform: uppercase; color: #aaa; margin-bottom: 1pt; }
    .val { font-size: 9.5pt; color: #1c1a18; border-bottom: .5pt solid #e4ddd2; padding-bottom: 2.5pt; }
    .check-row { display: grid; grid-template-columns: 14pt 1fr; gap: 6pt; padding: 5pt 0; border-bottom: .4pt solid #ede8e0; }
    .check-row.shade { background: #faf7f2; }
    .cb-col { padding-top: 1pt; }
    .checkbox { display: inline-block; width: 8.5pt; height: 8.5pt; border: .8pt solid ${gold}; border-radius: 1.5pt; }
    .desc-main { display: block; font-weight: bold; font-size: 9.5pt; }
    .vip-badge { display: inline-block; background: #f5ede0; color: #9a7030; font-size: 6.5pt; padding: 1pt 6pt; border-radius: 20pt; border: .5pt solid ${gold}; margin-left: 5pt; font-family: Arial, sans-serif; letter-spacing: .1em; }
    .meta { display: block; font-size: 8pt; color: #8a8480; margin-top: 1pt; font-style: italic; }
    .empty { font-style: italic; color: #bbb; font-size: 8.5pt; padding: 4pt 0; }
    .chips { display: flex; flex-wrap: wrap; gap: 4pt; padding: 4pt 0; }
    .chip { border: .6pt solid ${gold}; border-radius: 100pt; padding: 2pt 9pt; font-family: Arial, sans-serif; font-size: 6.5pt; letter-spacing: .1em; text-transform: uppercase; color: #9a7030; background: #fdf7ee; }
    .pri-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 3pt; padding: 4pt 0; }
    .pi { padding: 3pt 7pt; border: .5pt solid #e4ddd2; border-radius: 2pt; font-size: 7.5pt; color: #8a8480; font-family: Arial, sans-serif; }
    .pi-on { border-color: ${gold}; color: #1c1a18; background: #fdfbf5; font-weight: bold; }
    .col-head { display: grid; grid-template-columns: 14pt 1fr; gap: 6pt; padding: 3pt 0; border-bottom: .5pt solid ${gold}; }
    .col-lbl { font-family: Arial, sans-serif; font-size: 6pt; letter-spacing: .15em; text-transform: uppercase; color: #aaa; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; border-top: .5pt solid #ddd; padding: 5pt; font-family: Arial, sans-serif; font-size: 6pt; letter-spacing: .16em; text-transform: uppercase; color: #bbb; background: white; }
  `;

  const evLabel = (f.event_name || 'UNTITLED').toUpperCase();
  const timeline = parseList(f.event_timeline);
  const mustHaves = parseList(f.must_have_moments);
  const niceHaves = parseList(f.nice_to_have_moments);
  const people = parseList(f.people_to_capture);
  const groups = parseList(f.group_photos);

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Shot List — ${esc(f.event_name)}</title>
<style>${css}</style>
</head><body>

<div class="doc-header">
  <div>
    <div style="font-size:22pt;font-weight:900;letter-spacing:.12em;color:${gold};font-family:Arial,sans-serif;">DSM</div>
    <div style="font-size:7pt;letter-spacing:.3em;text-transform:uppercase;color:#888;font-family:Arial,sans-serif;">Photography</div>
  </div>
  <div class="dh-right">
    <div class="dh-title">Shot List</div>
    <div class="dh-event">${esc(f.event_name)}</div>
    <div class="dh-meta">${esc(fmtDate(f.event_date))}${f.venue ? ' &nbsp;·&nbsp; ' + esc(f.venue) : ''}</div>
    <div class="dh-stamp">Submitted ${esc(f.submitted_at)}</div>
  </div>
</div>

${sh('Your Event', 'Basic event details.')}
<div class="row2">
  ${field('Event Name', f.event_name)}
  ${field('Event Date', fmtDate(f.event_date))}
  ${field('Venue / Location', f.venue)}
  ${field('Package', f.package)}
  ${field('Client Name', f.client_name)}
  ${field('Day-of Contact', f.day_of_contact)}
</div>

${sh('Logistics & Arrival', 'Where to go and when to arrive.')}
<div class="row2">
  ${field('Where to Check In', f.checkin)}
  ${field('My Arrival Time', f.arrival_time)}
  ${field('Parking', f.parking)}
  ${field('Venue Contact', f.venue_contact)}
</div>
${fullField('Staging Area for Equipment', f.staging_area)}
${fullField('Access / Special Instructions', f.access_notes)}

${sh('Mood & Vibe', 'The feeling to aim for in every shot.')}
${chipRow(f.mood_vibe)}

${sh('What Matters Most', 'Priority guide for split-second decisions.')}
${priGrid(f.priorities)}

${timeline.length ? `${sh('Event Timeline', 'The order of the day — chronological.')}
<div class="col-head"><span></span><span class="col-lbl">Time &nbsp;·&nbsp; What\'s Happening &nbsp;·&nbsp; Location</span></div>
${checkList(timeline, 'No timeline entered.')}` : ''}

${mustHaves.length ? `${sh('Must-Have Moments', 'Non-negotiable shots. VIP = top priority.')}
<div class="col-head"><span></span><span class="col-lbl">Moment &nbsp;·&nbsp; Who &nbsp;·&nbsp; Notes</span></div>
${checkList(mustHaves, 'No must-haves entered.')}` : ''}

${niceHaves.length ? `${sh('Nice-to-Have Moments', 'Best effort — capture if timing allows.')}
${checkList(niceHaves, 'None entered.')}` : ''}

${people.length ? `${sh('People to Capture', 'Key individuals for the gallery.')}
${checkList(people, 'None entered.')}` : ''}

${groups.length ? `${sh('Group Photos — in Priority Order', 'Work top-down if time is short.')}
${checkList(groups, 'None entered.')}` : ''}

${(f.accessibility_notes && f.accessibility_notes !== '—') ? `${sh('Accessibility & Special Considerations', 'Guest needs and restrictions.')}
<div class="fb"><div class="val">${esc(f.accessibility_notes)}</div></div>` : ''}

${f.anything_else ? `${sh('Anything Else')}
<div class="fb"><div class="val">${esc(f.anything_else)}</div></div>` : ''}

${sh('Submission Record')}
<div class="fb"><div class="lbl">Submitted On</div><div class="val">${esc(f.submitted_at)}</div></div>

<div class="footer">Shot List &nbsp;·&nbsp; ${evLabel} &nbsp;·&nbsp; DSMPHOTOGRAPHY21@GMAIL.COM</div>
</body></html>`;
}

// ── Main handler ─────────────────────────────────────────
exports.handler = async function(event) {
  // Netlify sends form submissions as POST to /.netlify/functions/submission-created
  // The payload is in event.body as URL-encoded or JSON depending on Netlify version
  
  let fields = {};
  
  try {
    // Parse the form payload
    if (event.body) {
      const body = event.isBase64Encoded 
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;
      
      // Try JSON first (Netlify event-triggered functions)
      try {
        const parsed = JSON.parse(body);
        fields = parsed.payload && parsed.payload.data 
          ? parsed.payload.data 
          : parsed.data || parsed;
      } catch(e) {
        // Fall back to URL-encoded
        const params = new URLSearchParams(body);
        params.forEach((val, key) => { fields[key] = val; });
      }
    }

    // Skip spam submissions
    if (fields['bot-field']) {
      return { statusCode: 200, body: 'OK' };
    }

    const clientEmail = fields['client_email'] || null;
    const eventName = fields['event_name'] || 'Your Event';
    const clientName = fields['client_name'] || 'Client';
    const submittedAt = fields['submitted_at'] || new Date().toLocaleString();

    // Build the print HTML
    const printHTML = buildPrintHTML(fields);
    
    // Base64 encode HTML for attachment
    const htmlAttachment = Buffer.from(printHTML).toString('base64');

    // ── Email 1: To you (Dayna) with PDF attachment ──
    const toPhotographer = {
      personalizations: [{
        to: [{ email: 'dsmphotography21@gmail.com', name: 'DSM Photography' }],
        subject: `New Shot List — ${eventName}`
      }],
      from: { email: 'dsmphotography21@gmail.com', name: 'DSM Photography' },
      reply_to: { email: 'dsmphotography21@gmail.com' },
      content: [{
        type: 'text/html',
        value: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1c1a18;">
            <div style="background:#1c1a18;padding:24px 32px;">
              <div style="font-size:22px;font-weight:900;letter-spacing:.1em;color:#dec08c;">DSM Photography</div>
            </div>
            <div style="padding:32px;">
              <h2 style="color:#c8a870;font-size:18px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:16px;">New Shot List Submission</h2>
              <p style="margin-bottom:8px;"><strong>Client:</strong> ${clientName}</p>
              <p style="margin-bottom:8px;"><strong>Event:</strong> ${eventName}</p>
              <p style="margin-bottom:8px;"><strong>Date:</strong> ${fields['event_date'] || '—'}</p>
              <p style="margin-bottom:8px;"><strong>Venue:</strong> ${fields['venue'] || '—'}</p>
              <p style="margin-bottom:24px;"><strong>Submitted:</strong> ${submittedAt}</p>
              <p style="color:#666;font-size:13px;">The complete shot list is attached as an HTML file. Open it in any browser and use File → Print → Save as PDF to get your formatted PDF.</p>
            </div>
            <div style="background:#f5ede0;padding:16px 32px;border-top:2px solid #c8a870;">
              <p style="font-size:11px;color:#9a7030;letter-spacing:.08em;text-transform:uppercase;margin:0;">DSM Photography &nbsp;·&nbsp; dsmphotolab.com</p>
            </div>
          </div>
        `
      }],
      attachments: [{
        content: htmlAttachment,
        filename: `Shot-List-${eventName.replace(/[^a-z0-9]/gi,'_')}.html`,
        type: 'text/html',
        disposition: 'attachment'
      }]
    };

    await sendEmail(toPhotographer);

    // ── Email 2: Confirmation to client (if email provided) ──
    // Note: client email field not currently in form — this is ready for when you add it
    if (clientEmail && clientEmail.includes('@')) {
      const toClient = {
        personalizations: [{
          to: [{ email: clientEmail, name: clientName }],
          subject: `Your Shot List for ${eventName} — DSM Photography`
        }],
        from: { email: 'dsmphotography21@gmail.com', name: 'DSM Photography' },
        reply_to: { email: 'dsmphotography21@gmail.com' },
        content: [{
          type: 'text/html',
          value: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1c1a18;">
              <div style="background:#1c1a18;padding:24px 32px;">
                <div style="font-size:22px;font-weight:900;letter-spacing:.1em;color:#dec08c;">DSM Photography</div>
              </div>
              <div style="padding:32px;">
                <h2 style="color:#c8a870;font-size:18px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:16px;">Shot List Received!</h2>
                <p style="margin-bottom:16px;">Hi ${clientName},</p>
                <p style="margin-bottom:16px;">Your shot list for <strong>${eventName}</strong> has been received. Dayna will review it and reach out if she has any questions before your event.</p>
                <p style="margin-bottom:24px;">Your completed shot list is attached for your records.</p>
                <p style="color:#666;font-size:13px;">Need to make changes? Simply go back to the form, update your answers, and submit again. Each submission is timestamped so Dayna will always have the most current version.</p>
              </div>
              <div style="background:#f5ede0;padding:16px 32px;border-top:2px solid #c8a870;">
                <p style="font-size:11px;color:#9a7030;letter-spacing:.08em;text-transform:uppercase;margin:0;">DSM Photography &nbsp;·&nbsp; dsmphotolab.com</p>
              </div>
            </div>
          `
        }],
        attachments: [{
          content: htmlAttachment,
          filename: `Shot-List-${eventName.replace(/[^a-z0-9]/gi,'_')}.html`,
          type: 'text/html',
          disposition: 'attachment'
        }]
      };
      await sendEmail(toClient);
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch(err) {
    console.error('submission-created error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
