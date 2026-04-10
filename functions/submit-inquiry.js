// functions/submit-inquiry.js
// Handles form submission → sends HTML emails via SendGrid (no PDFKit)

const sgMail = require('@sendgrid/mail');

const TYPE_CODE_MAP = {
  event:'EVT', portrait:'PRT', headshot:'HDT', lifestyle:'LST',
  maternity:'MAT', engagement:'ENG', proposal:'PRP', wedding:'WED',
  creative:'CRE', realestate:'RST', general:'GEN', other:'OTH',
  'other-session':'OTH',
};

const TYPE_LABELS = {
  EVT:'Event Coverage', PRT:'Portrait Session', HDT:'Headshot Session',
  LST:'Lifestyle Session', MAT:'Maternity Session', ENG:'Engagement Session',
  PRP:'Proposal Coverage', WED:'Wedding Coverage', CRE:'Creative Session',
  RST:'Real Estate Photography', GEN:'General Inquiry', OTH:'Other Inquiry',
};

const TYPE_COLORS = {
  EVT:'#dec08c', PRT:'#f5d2c4', HDT:'#f5d2c4', LST:'#f5d2c4',
  MAT:'#f5d2c4', ENG:'#a8dbd2', PRP:'#a8dbd2', WED:'#a8dbd2',
  CRE:'#c9856a', RST:'#8aabb5', GEN:'#b8a99a', OTH:'#b8a99a',
};

function generateRefNumber(typeCode, seq) {
  const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
  return `DSM-${date}-${typeCode}-${String(seq).padStart(4,'0')}`;
}

function formatLabel(key) {
  return key.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()).trim();
}

const SKIP_KEYS = new Set([
  'inquiryType','sessionType','sequenceNumber','hardBudgetCapSelect',
  'addEngagement','addWedding','_refNumber',
]);

function buildFieldsHtml(data) {
  return Object.entries(data)
    .filter(([k,v]) => !SKIP_KEYS.has(k) && v && String(v).trim())
    .map(([k,v]) => `
      <tr>
        <td style="padding:7px 12px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;
                   color:#8a7d72;white-space:nowrap;vertical-align:top;border-bottom:1px solid #f0ebe4;">
          ${formatLabel(k)}
        </td>
        <td style="padding:7px 12px;font-size:13px;color:#2c2418;vertical-align:top;
                   border-bottom:1px solid #f0ebe4;line-height:1.6;">
          ${String(v).replace(/\n/g,'<br>')}
        </td>
      </tr>`).join('');
}

function buildIntakeHtml(data, refNumber, typeLabel, accentColor, isUrgent) {
  const urgentBanner = isUrgent
    ? `<div style="background:#c9856a;color:#fff;padding:10px 24px;font-size:11px;
                   letter-spacing:.15em;text-transform:uppercase;text-align:center;">
         Urgent — date within 60 days
       </div>` : '';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f7f3ed;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:620px;margin:32px auto;background:#fff;border:1px solid #e8e0d6;">
  <div style="background:#100f09;padding:28px 32px;">
    <div style="font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:4px;">New Inquiry</div>
    <div style="font-size:22px;font-weight:300;color:#fff;letter-spacing:.04em;">DSM Photography</div>
  </div>
  ${urgentBanner}
  <div style="background:#fdfaf6;border-bottom:1px solid #ede8e0;padding:16px 32px;">
    <span style="background:${accentColor};color:#100f09;font-size:10px;letter-spacing:.18em;text-transform:uppercase;padding:5px 12px;font-weight:600;">${typeLabel}</span>
    <span style="font-size:11px;letter-spacing:.12em;color:#8a7d72;float:right;">${refNumber}</span>
  </div>
  <table style="width:100%;border-collapse:collapse;">${buildFieldsHtml(data)}</table>
  <div style="background:#fdfaf6;border-top:1px solid #ede8e0;padding:14px 32px;font-size:10px;letter-spacing:.1em;color:#b8a99a;text-align:center;">
    DSM Photography &middot; Miami, FL &middot; dsmphotography21@gmail.com
  </div>
</div></body></html>`;
}

function buildConfirmationHtml(data, refNumber, typeLabel, accentColor) {
  const firstName = data.firstName || 'there';
  const steps = [
    ['Within 48 hours','I\'ll review your inquiry and reach out to confirm details and availability.'],
    ['We\'ll connect','A quick call or email exchange to make sure we\'re a great fit.'],
    ['You\'re booked','Contract and deposit info sent — and your date is officially held.'],
  ];
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f7f3ed;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:580px;margin:32px auto;background:#fff;border:1px solid #e8e0d6;">
  <div style="background:#100f09;padding:36px 40px;text-align:center;">
    <div style="font-size:10px;letter-spacing:.35em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:10px;">Miami, Florida</div>
    <div style="font-size:26px;font-weight:300;color:#fff;letter-spacing:.06em;">DSM Photography</div>
    <div style="width:40px;height:1px;background:${accentColor};margin:16px auto 0;"></div>
  </div>
  <div style="padding:40px 40px 32px;">
    <p style="font-size:22px;font-weight:300;color:#2c2418;margin:0 0 8px;">Thank you, ${firstName}.</p>
    <p style="font-size:13px;color:#8a7d72;line-height:1.9;margin:0 0 28px;">
      Your inquiry has been received. I'll be in touch within <strong style="color:#2c2418;">48 hours</strong>.
    </p>
    <div style="background:#fdfaf6;border:1px solid #ede8e0;border-left:3px solid ${accentColor};padding:14px 18px;margin-bottom:28px;">
      <div style="font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:#b8a99a;margin-bottom:4px;">Your reference number</div>
      <div style="font-size:14px;letter-spacing:.1em;color:#2c2418;font-weight:500;">${refNumber}</div>
      <div style="font-size:10px;color:#b8a99a;margin-top:3px;">${typeLabel}</div>
    </div>
    <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#b8a99a;margin-bottom:14px;">What happens next</div>
    <table style="width:100%;border-collapse:collapse;">
      ${steps.map(([step,desc],i)=>`
      <tr>
        <td style="width:28px;padding:8px 10px 8px 0;vertical-align:top;">
          <div style="width:22px;height:22px;border-radius:50%;background:${accentColor};font-size:10px;font-weight:600;color:#100f09;text-align:center;line-height:22px;">${i+1}</div>
        </td>
        <td style="padding:8px 0;vertical-align:top;border-bottom:1px solid #f0ebe4;">
          <div style="font-size:11px;font-weight:600;color:#2c2418;margin-bottom:2px;">${step}</div>
          <div style="font-size:12px;color:#8a7d72;line-height:1.7;">${desc}</div>
        </td>
      </tr>`).join('')}
    </table>
  </div>
  <div style="padding:0 40px 36px;">
    <p style="font-size:13px;color:#8a7d72;line-height:1.9;margin:0 0 6px;">Looking forward to connecting,</p>
    <p style="font-size:20px;font-style:italic;font-weight:300;color:${accentColor};margin:0;">Dayna S. McKenzie</p>
    <p style="font-size:11px;color:#b8a99a;margin:4px 0 0;letter-spacing:.06em;">DSM Photography &middot; Miami, FL</p>
  </div>
  <div style="background:#fdfaf6;border-top:1px solid #ede8e0;padding:14px 40px;font-size:10px;color:#b8a99a;text-align:center;letter-spacing:.08em;">
    dsmphotography21@gmail.com &middot; @DSM_Photography
  </div>
</div></body></html>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  try {
    const data = JSON.parse(event.body || '{}');
    const rawType     = data.inquiryType || 'general';
    const typeCode    = TYPE_CODE_MAP[rawType] || 'OTH';
    const typeLabel   = TYPE_LABELS[typeCode]  || 'Inquiry';
    const accentColor = TYPE_COLORS[typeCode]  || '#dec08c';
    const seq         = parseInt(data.sequenceNumber || '1000', 10);
    const refNumber   = generateRefNumber(typeCode, seq);

    const today = Date.now();
    const isUrgent = ['eventDate','date1','weddingDate','mlsDeadline'].some(f => {
      if (!data[f]) return false;
      const days = (new Date(data[f]).getTime() - today) / 864e5;
      return days > 0 && days <= 60;
    });

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const from = { email: 'dsmphotography21@gmail.com', name: 'DSM Photography' };

    const messages = [{
      to: 'dsmphotography21@gmail.com',
      from,
      subject: `[${typeCode}${isUrgent?' URGENT':''}] New Inquiry — ${data.firstName||''} ${data.lastName||''} · ${refNumber}`,
      html: buildIntakeHtml(data, refNumber, typeLabel, accentColor, isUrgent),
    }];

    if (data.email) {
      messages.push({
        to: data.email,
        from,
        replyTo: 'dsmphotography21@gmail.com',
        subject: `Your inquiry is received — DSM Photography · ${refNumber}`,
        html: buildConfirmationHtml(data, refNumber, typeLabel, accentColor),
      });
    }

    await Promise.all(messages.map(m => sgMail.send(m)));
    return { statusCode: 200, body: JSON.stringify({ success: true, refNumber }) };

  } catch (err) {
    console.error('submit-inquiry error:', err.message || err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
