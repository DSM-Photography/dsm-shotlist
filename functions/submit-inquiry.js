// functions/submit-inquiry.js
// Form POST handler — sends via SendGrid
// Dayna receives: elegant section-grouped HTML intake document
// Client receives: branded confirmation with reference number + next steps


// ── Type maps ─────────────────────────────────────────────────
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

// ── Utilities ─────────────────────────────────────────────────
function generateRefNumber(typeCode, seq) {
  const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
  return `DSM-${date}-${typeCode}-${String(seq).padStart(4,'0')}`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtLabel(key) {
  return key.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()).trim();
}

function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T12:00:00'); // noon to avoid TZ day-shift
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
}

const SKIP_KEYS = new Set([
  'inquiryType','sessionType','sequenceNumber','hardBudgetCapSelect',
  'addEngagement','addWedding','_refNumber','_pdfBase64',
  // raw date fields collapsed into preferredDates by collect()
  'date1','date2','date3',
]);

// Date-like field names — rendered with formatted date
const DATE_FIELDS = new Set([
  'eventDate','preferredDates','weddingDate','dueDate','engDate1','engDate2','engDate3',
  'proposalDate','contentDeadline','mlsDeadline','weddingDateCross',
]);

// Narrative / long-text fields — rendered differently
const NARRATIVE_FIELDS = new Set([
  'sessionNarrative','eventNarrative','coupleStory','weddingVisionCross',
  'specificShots','moodReferences','customQuoteDetails','coverStory',
]);

// ── Section schema — defines grouping order for the intake email ──
// Each section has a label and the field keys that belong to it (in order).
// Fields not matched to any section fall into "Additional Details" at the end.
const SECTIONS = [
  {
    label: 'Client',
    icon: '◇',
    fields: ['firstName','lastName','email','phone','preferredContact','howHeard'],
  },
  {
    label: 'Inquiry',
    icon: '◇',
    fields: [
      'inquiryType','sessionType',
      // event
      'eventType','eventDate','venue','guestCount','indoorOutdoor',
      // sessions
      'occasion','intendedUse','creativeType',
      // wedding
      'partnerName','season','colorPalette','weddingPartySize','guestCount',
      'ceremonyVenue','receptionVenue','numLocations','ceremonyStart',
      'bridalPartySession','secondShooter','hasVideographer','coordinator',
      'portionsCovered',
      // proposal
      'proposalDate','whoInvolved','coverageScope','photographerRole','coverStory',
      // maternity
      'dueDate',
      // real estate
      'propertyAddress','propertyType','listingStatus','sqFootage','bedsBaths',
      'clientRole','brokerage','stagingStatus','mlsDeadline','servicesNeeded',
      // shared
      'numSubjects','indoorOutdoor',
    ],
  },
  {
    label: 'Dates & Logistics',
    icon: '◇',
    fields: [
      'preferredDates','timeOfDay','outfitChanges',
      'locationPref','specificLocation','locationAccess',
      'engDate1','engDate2','engDate3',
      'contentDeadline',
    ],
  },
  {
    label: 'Package & Budget',
    icon: '◇',
    fields: [
      'packageInterest','addOns','budgetRange','hardBudgetCap',
      'expeditedDelivery','additionalImages',
    ],
  },
  {
    label: 'Cross-Booking',
    icon: '◇',
    fields: [
      'addEngagement','addWedding',
      'engLocationPref','engSpecificLocation','engLocationAccess',
      'weddingDate','weddingVisionCross',
    ],
  },
  {
    label: 'Vision & Notes',
    icon: '◇',
    fields: [
      'sessionNarrative','eventNarrative','coupleStory',
      'specificShots','moodReferences','customQuoteDetails',
    ],
  },
];

// ── Build intake email HTML ────────────────────────────────────
function buildIntakeHtml(data, refNumber, typeLabel, accentColor, isUrgent, submittedAt) {

  // Flatten data into a map for easy lookup, skip blank/skipped keys
  const available = {};
  for (const [k, v] of Object.entries(data)) {
    if (!SKIP_KEYS.has(k) && v && String(v).trim()) {
      available[k] = v;
    }
  }

  // Track which keys have been rendered so we can catch stragglers
  const rendered = new Set();

  // Render a single field row
  function fieldRow(key, value, isNarrative) {
    rendered.add(key);
    let displayVal = esc(String(value));

    // Format date fields
    if (DATE_FIELDS.has(key) && !key.includes('preferred')) {
      // preferredDates is already a formatted string from collect()
      const formatted = fmtDate(value);
      if (formatted) displayVal = esc(formatted);
    }

    displayVal = displayVal.replace(/\n/g, '<br>');

    if (isNarrative) {
      return `
        <tr>
          <td colspan="2" style="padding:14px 20px;border-bottom:1px solid #f0ebe4;">
            <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#b8a99a;margin-bottom:6px;">${esc(fmtLabel(key))}</div>
            <div style="font-size:13px;color:#2c2418;line-height:1.85;background:#fdfaf6;border-left:3px solid ${accentColor};padding:12px 16px;">${displayVal}</div>
          </td>
        </tr>`;
    }

    return `
      <tr>
        <td style="padding:9px 12px 9px 20px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8a7d72;white-space:nowrap;vertical-align:top;border-bottom:1px solid #f0ebe4;width:160px;">${esc(fmtLabel(key))}</td>
        <td style="padding:9px 20px 9px 12px;font-size:13px;color:#2c2418;vertical-align:top;border-bottom:1px solid #f0ebe4;line-height:1.7;">${displayVal}</td>
      </tr>`;
  }

  // Render a section — returns empty string if no fields have data
  function renderSection(section) {
    const rows = [];
    for (const key of section.fields) {
      if (available[key] !== undefined && !rendered.has(key)) {
        const isNarr = NARRATIVE_FIELDS.has(key);
        rows.push(fieldRow(key, available[key], isNarr));
      }
    }
    if (rows.length === 0) return '';

    return `
      <div style="margin:0;">
        <div style="background:#fdfaf6;border-top:1px solid #ede8e0;border-bottom:1px solid #ede8e0;
                    padding:9px 20px;display:flex;align-items:center;gap:8px;">
          <span style="color:${accentColor};font-size:10px;">${section.icon}</span>
          <span style="font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#8a7d72;font-weight:600;">${section.label}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">${rows.join('')}</table>
      </div>`;
  }

  // Render all defined sections
  const sectionBlocks = SECTIONS.map(renderSection).filter(Boolean).join('');

  // Catch any remaining fields not placed in a section
  const stragglerRows = [];
  for (const [key, value] of Object.entries(available)) {
    if (!rendered.has(key)) {
      stragglerRows.push(fieldRow(key, value, NARRATIVE_FIELDS.has(key)));
    }
  }
  const stragglerBlock = stragglerRows.length ? `
    <div style="margin:0;">
      <div style="background:#fdfaf6;border-top:1px solid #ede8e0;border-bottom:1px solid #ede8e0;
                  padding:9px 20px;display:flex;align-items:center;gap:8px;">
        <span style="color:${accentColor};font-size:10px;">◇</span>
        <span style="font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#8a7d72;font-weight:600;">Additional Details</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">${stragglerRows.join('')}</table>
    </div>` : '';

  const urgentBanner = isUrgent ? `
    <div style="background:#c9856a;color:#fff;padding:10px 28px;font-size:10px;
                letter-spacing:.2em;text-transform:uppercase;text-align:center;font-weight:600;">
      ⚑ &nbsp; Date within 60 days — prioritize this inquiry
    </div>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:24px 0 40px;background:#f2ede8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #ddd8d0;box-shadow:0 2px 16px rgba(0,0,0,.07);">

  <!-- HEADER -->
  <div style="background:#100f09;padding:24px 28px 20px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
      <tr>
        <td style="font-size:9px;letter-spacing:.38em;text-transform:uppercase;color:rgba(255,255,255,.35);vertical-align:middle;">Incoming Inquiry</td>
        <td style="text-align:right;vertical-align:middle;">
          <div style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:3px;">Reference</div>
          <div style="font-size:11px;letter-spacing:.08em;color:#dec08c;font-family:monospace;">${esc(refNumber)}</div>
          <div style="font-size:9px;color:rgba(255,255,255,.22);margin-top:3px;">${esc(submittedAt)}</div>
        </td>
      </tr>
    </table>
    <img src="${LOGO_B64}" alt="DSM Photography" style="height:48px;width:auto;display:block;margin-bottom:8px;"/>
    <div style="font-size:10px;letter-spacing:.06em;color:rgba(255,255,255,.28);">Miami, FL &nbsp;&middot;&nbsp; dsmphotography21@gmail.com</div>
  </div>

  ${urgentBanner}

  <!-- INQUIRY TYPE BADGE -->
  <div style="background:#faf6f0;border-bottom:1px solid #ede8e0;padding:14px 28px;display:flex;align-items:center;gap:14px;">
    <span style="background:${accentColor};color:#100f09;font-size:9px;letter-spacing:.2em;text-transform:uppercase;padding:5px 14px;font-weight:700;">${esc(typeLabel)}</span>
    <span style="font-size:11px;color:#b8a99a;letter-spacing:.04em;">New client inquiry submitted via dsmphotolab.com</span>
  </div>

  <!-- BODY: SECTIONS -->
  ${sectionBlocks}
  ${stragglerBlock}

  <!-- FOOTER -->
  <div style="background:#fdfaf6;border-top:2px solid #ede8e0;padding:18px 28px;text-align:center;">
    <div style="font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#b8a99a;">
      DSM Photography &nbsp;&middot;&nbsp; Miami, FL &nbsp;&middot;&nbsp; dsmphotography21@gmail.com &nbsp;&middot;&nbsp; @DSM_Photography
    </div>
    <div style="width:32px;height:1px;background:#dec08c;margin:10px auto 0;opacity:.5;"></div>
  </div>

</div>
</body>
</html>`;
}

// ── Client confirmation email ─────────────────────────────────
function buildConfirmationHtml(data, refNumber, typeLabel, accentColor) {
  const firstName = data.firstName || 'there';
  const steps = [
    ['Within 48 hours', 'I\'ll review your inquiry and reach out to confirm details and availability.'],
    ['We\'ll connect',  'A quick call or email to make sure we\'re a great fit and answer any questions.'],
    ['You\'re booked',  'Contract and deposit info sent — and your date is officially held.'],
  ];
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:24px 0 40px;background:#f2ede8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:580px;margin:0 auto;background:#fff;border:1px solid #ddd8d0;box-shadow:0 2px 16px rgba(0,0,0,.07);">

  <div style="background:#100f09;padding:36px 40px;text-align:center;">
    <div style="font-size:9px;letter-spacing:.38em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:10px;">Miami, Florida</div>
    <div style="font-size:22px;font-weight:300;letter-spacing:.1em;text-transform:uppercase;color:#ffffff;">DSM Photography</div>
    <div style="width:36px;height:1px;background:${accentColor};margin:14px auto 0;"></div>
  </div>

  <div style="padding:40px 40px 28px;">
    <p style="font-size:22px;font-weight:300;color:#2c2418;margin:0 0 8px;letter-spacing:.01em;">Thank you, ${esc(firstName)}.</p>
    <p style="font-size:13px;color:#8a7d72;line-height:1.9;margin:0 0 28px;">
      Your inquiry has been received and I'm excited to connect. I'll be in touch within <strong style="color:#2c2418;font-weight:600;">48 hours</strong>.
    </p>

    <div style="background:#fdfaf6;border:1px solid #ede8e0;border-left:3px solid ${accentColor};padding:16px 18px;margin-bottom:32px;">
      <div style="font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:#b8a99a;margin-bottom:5px;">Your reference number</div>
      <div style="font-size:15px;letter-spacing:.08em;color:#2c2418;font-weight:500;font-family:monospace;">${esc(refNumber)}</div>
      <div style="font-size:10px;color:#b8a99a;margin-top:3px;letter-spacing:.04em;">${esc(typeLabel)}</div>
    </div>

    <div style="font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:#b8a99a;margin-bottom:14px;">What happens next</div>
    <table style="width:100%;border-collapse:collapse;">
      ${steps.map(([step, desc], i) => `
      <tr>
        <td style="width:32px;padding:10px 12px 10px 0;vertical-align:top;">
          <div style="width:24px;height:24px;border-radius:50%;background:${accentColor};font-size:10px;font-weight:700;color:#100f09;text-align:center;line-height:24px;">${i+1}</div>
        </td>
        <td style="padding:10px 0;vertical-align:top;border-bottom:1px solid #f0ebe4;">
          <div style="font-size:11px;font-weight:600;color:#2c2418;margin-bottom:3px;letter-spacing:.02em;">${esc(step)}</div>
          <div style="font-size:12px;color:#8a7d72;line-height:1.75;">${esc(desc)}</div>
        </td>
      </tr>`).join('')}
    </table>
  </div>

  <div style="padding:0 40px 36px;">
    <p style="font-size:13px;color:#8a7d72;line-height:1.9;margin:0 0 6px;">Looking forward to connecting,</p>
    <p style="font-size:22px;font-style:italic;font-weight:300;color:${accentColor};margin:0;letter-spacing:.02em;">Dayna S. McKenzie</p>
    <p style="font-size:11px;color:#b8a99a;margin:5px 0 0;letter-spacing:.06em;">DSM Photography &nbsp;&middot;&nbsp; Miami, FL</p>
  </div>

  <div style="background:#fdfaf6;border-top:1px solid #ede8e0;padding:16px 40px;font-size:10px;color:#b8a99a;text-align:center;letter-spacing:.08em;">
    dsmphotography21@gmail.com &nbsp;&middot;&nbsp; @DSM_Photography
  </div>
</div>
</body>
</html>`;
}

// ── Lambda handler ────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  try {
    const data       = JSON.parse(event.body || '{}');
    const rawType    = data.inquiryType || 'general';
    const typeCode   = TYPE_CODE_MAP[rawType]  || 'OTH';
    const typeLabel  = TYPE_LABELS[typeCode]   || 'Inquiry';
    const accentColor = TYPE_COLORS[typeCode]  || '#dec08c';
    const seq        = parseInt(data.sequenceNumber || '1000', 10);
    const refNumber  = generateRefNumber(typeCode, seq);

    // Submitted timestamp (server-side, reliable)
    const now = new Date();
    const submittedAt = now.toLocaleDateString('en-US', {
      month:'long', day:'numeric', year:'numeric',
    }) + ' at ' + now.toLocaleTimeString('en-US', {
      hour:'numeric', minute:'2-digit', hour12:true,
    });

    // Urgency check — is any key date within 60 days?
    const todayMs = Date.now();
    const isUrgent = ['eventDate','date1','weddingDate','weddingDateCross','proposalDate','mlsDeadline'].some(f => {
      if (!data[f]) return false;
      const diff = (new Date(data[f]).getTime() - todayMs) / 864e5;
      return diff > 0 && diff <= 60;
    });

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const from = { email: 'dsmphotography21@gmail.com', name: 'DSM Photography' };

    const urgentFlag = isUrgent ? ' ⚑ URGENT' : '';
    const clientName = [data.firstName, data.lastName].filter(Boolean).join(' ') || 'New Client';

    const messages = [
      // Intake email to Dayna
      {
        to: 'dsmphotography21@gmail.com',
        from,
        subject: `[${typeCode}${urgentFlag}] ${clientName} — ${refNumber}`,
        html: buildIntakeHtml(data, refNumber, typeLabel, accentColor, isUrgent, submittedAt),
      },
    ];

    // Confirmation email to client
    if (data.email) {
      messages.push({
        to: data.email,
        from,
        replyTo: 'dsmphotography21@gmail.com',
        subject: `Inquiry received — DSM Photography · ${refNumber}`,
        html: buildConfirmationHtml(data, refNumber, typeLabel, accentColor),
      });
    }

    await Promise.all(messages.map(m => sgMail.send(m)));

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, refNumber }),
    };

  } catch (err) {
    console.error('submit-inquiry error:', err.response?.body || err.message || err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
