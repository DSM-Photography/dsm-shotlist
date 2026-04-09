// netlify/functions/submit-inquiry.js
// Handles form submission → generates two PDFs → sends via SendGrid

const sgMail = require('@sendgrid/mail');
const PDFDocument = require('pdfkit');

// ── BRAND COLORS (RGB) ──────────────────────────────────────────────────────
const COLORS = {
  dark:       [16,  15,  9],
  warmWhite:  [253, 250, 246],
  gold:       [222, 192, 140],
  goldLight:  [237, 221, 176],
  muted:      [119, 106,  95],
  mutedLight: [200, 190, 183],

  // Type badge colors
  EVT: [222, 192, 140],   // gold
  PRT: [245, 210, 196],   // blush
  HDT: [245, 210, 196],   // blush
  LST: [245, 210, 196],   // blush
  MAT: [245, 210, 196],   // blush
  ENG: [168, 219, 210],   // mint
  PRP: [168, 219, 210],   // mint
  WED: [168, 219, 210],   // mint
  CRE: [201, 133, 106],   // terracotta
  RST: [138, 171, 181],   // slate teal
  GEN: [184, 169, 154],   // warm taupe
  OTH: [184, 169, 154],   // warm taupe
};

const TYPE_LABELS = {
  EVT: 'Event Coverage',
  PRT: 'Portrait Session',
  HDT: 'Headshot Session',
  LST: 'Lifestyle Session',
  MAT: 'Maternity Session',
  ENG: 'Engagement Session',
  PRP: 'Proposal Coverage',
  WED: 'Wedding Coverage',
  CRE: 'Creative Session',
  RST: 'Real Estate Photography',
  GEN: 'General Inquiry',
  OTH: 'Other Inquiry',
};

// ── REFERENCE NUMBER ────────────────────────────────────────────────────────
function generateRefNumber(typeCode, sequenceNumber) {
  const now = new Date();
  const date = now.toISOString().slice(0,10).replace(/-/g,'');
  const seq  = String(sequenceNumber).padStart(4, '0');
  return `DSM-${date}-${typeCode}-${seq}`;
}

// ── HELPERS ─────────────────────────────────────────────────────────────────
function rgbToHex([r,g,b]) {
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

function setFill(doc, rgb)   { doc.fillColor(rgbToHex(rgb)); }
function setStroke(doc, rgb) { doc.strokeColor(rgbToHex(rgb)); }

function drawRect(doc, x, y, w, h, rgb) {
  setFill(doc, rgb);
  doc.rect(x, y, w, h).fill();
}

function sectionHeader(doc, label, y, pageW) {
  // Gold rule above label
  setStroke(doc, COLORS.gold);
  doc.moveTo(48, y).lineTo(pageW - 48, y).lineWidth(0.5).stroke();
  y += 8;
  setFill(doc, COLORS.gold);
  doc.font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), 48, y, { characterSpacing: 1.5 });
  return y + 18;
}

function fieldRow(doc, label, value, y, pageW, highlight) {
  if (!value || value === '' || value === 'undefined') return y;
  const labelW = 160;
  const valueX = 48 + labelW + 8;
  const valueW = pageW - 48 - labelW - 8 - 48;

  setFill(doc, COLORS.muted);
  doc.font('Helvetica').fontSize(8).text(label, 48, y, { width: labelW });

  setFill(doc, highlight ? COLORS.gold : COLORS.dark);
  doc.font(highlight ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
     .text(value, valueX, y, { width: valueW });

  const rowH = Math.max(
    doc.heightOfString(label,  { width: labelW,  fontSize: 8   }),
    doc.heightOfString(value,  { width: valueW,  fontSize: 8.5 })
  ) + 10;

  // Light rule
  setStroke(doc, COLORS.mutedLight);
  doc.moveTo(48, y + rowH - 4).lineTo(pageW - 48, y + rowH - 4).lineWidth(0.25).opacity(0.3).stroke().opacity(1);

  return y + rowH;
}

function narrativeField(doc, label, value, y, pageW) {
  if (!value || value === '') return y;
  setFill(doc, COLORS.muted);
  doc.font('Helvetica-Bold').fontSize(7.5).text(label.toUpperCase(), 48, y, { characterSpacing: 1 });
  y += 14;

  // Inset box
  const boxW = pageW - 96;
  const textH = doc.heightOfString(value, { width: boxW - 24, fontSize: 9 });
  const boxH  = textH + 20;

  drawRect(doc, 48, y, boxW, boxH, [245, 242, 237]);
  setFill(doc, COLORS.dark);
  doc.font('Helvetica').fontSize(9).text(value, 60, y + 10, { width: boxW - 24 });

  return y + boxH + 14;
}

// ── CHECK IF URGENT ─────────────────────────────────────────────────────────
function checkUrgency(data) {
  const flags = [];
  if (data.sessionDate || data.eventDate || data.weddingDate) {
    const dateStr = data.sessionDate || data.eventDate || data.weddingDate;
    const sessionDate = new Date(dateStr);
    const today = new Date();
    const daysOut = Math.ceil((sessionDate - today) / (1000*60*60*24));
    if (!isNaN(daysOut) && daysOut <= 60 && daysOut > 0) {
      flags.push(`Date is ${daysOut} days out (within 60-day window)`);
    }
  }
  if (data.hardBudgetCap && data.hardBudgetCap.toLowerCase() !== 'no' && data.hardBudgetCap !== '') {
    flags.push(`Hard budget cap indicated: ${data.hardBudgetCap}`);
  }
  return flags;
}

// ── INTERNAL PDF ────────────────────────────────────────────────────────────
async function buildInternalPDF(data, refNumber, typeCode) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true });

    doc.on('data',  chunk => chunks.push(chunk));
    doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
    doc.on('error', err   => reject(err));

    const pageW = doc.page.width;   // 612
    const pageH = doc.page.height;  // 792
    const badgeColor = COLORS[typeCode] || COLORS.GEN;
    const urgencyFlags = checkUrgency(data);

    // ── HEADER BAND ──
    drawRect(doc, 0, 0, pageW, 80, COLORS.dark);

    // Type badge pill
    drawRect(doc, 48, 22, 120, 18, badgeColor);
    setFill(doc, COLORS.dark);
    doc.font('Helvetica-Bold').fontSize(7).text(
      TYPE_LABELS[typeCode] || 'Inquiry',
      48, 27, { width: 120, align: 'center', characterSpacing: 1 }
    );

    // Ref number
    setFill(doc, COLORS.goldLight);
    doc.font('Helvetica').fontSize(7).text(refNumber, pageW - 200, 27, { width: 152, align: 'right' });

    // DSM wordmark
    setFill(doc, COLORS.warmWhite);
    doc.font('Helvetica-Bold').fontSize(18).text('DSM PHOTOGRAPHY', 48, 46, { characterSpacing: 2 });

    // Submission timestamp
    setFill(doc, COLORS.muted);
    doc.font('Helvetica').fontSize(7).text(
      `Received: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}`,
      pageW - 200, 46, { width: 152, align: 'right' }
    );

    let y = 96;

    // ── URGENCY BANNER ──
    if (urgencyFlags.length > 0) {
      drawRect(doc, 0, y, pageW, urgencyFlags.length * 18 + 16, [201, 133, 106]); // terracotta
      setFill(doc, COLORS.warmWhite);
      doc.font('Helvetica-Bold').fontSize(7.5).text('ATTENTION', 48, y + 6, { characterSpacing: 1.5 });
      urgencyFlags.forEach((flag, i) => {
        doc.font('Helvetica').fontSize(8).text(`• ${flag}`, 48, y + 6 + 14 + (i * 14));
      });
      y += urgencyFlags.length * 18 + 24;
    }

    y += 8;

    // ── CONTACT INFO SECTION ──
    y = sectionHeader(doc, 'Client Information', y, pageW);
    y = fieldRow(doc, 'Name',             `${data.firstName || ''} ${data.lastName || ''}`.trim(), y, pageW);
    y = fieldRow(doc, 'Email',            data.email,           y, pageW);
    y = fieldRow(doc, 'Phone',            data.phone,           y, pageW);
    y = fieldRow(doc, 'Preferred Contact',data.preferredContact, y, pageW);
    y = fieldRow(doc, 'How They Found You',data.howHeard,       y, pageW);
    y += 8;

    // ── INQUIRY DETAILS ──
    y = sectionHeader(doc, 'Inquiry Details', y, pageW);
    y = fieldRow(doc, 'Inquiry Type',     TYPE_LABELS[typeCode], y, pageW);

    // Dynamic fields by type
    if (typeCode === 'EVT') {
      y = fieldRow(doc, 'Event Date',       data.eventDate,       y, pageW, urgencyFlags.some(f => f.includes('days out')));
      y = fieldRow(doc, 'Event Type',       data.eventType,       y, pageW);
      y = fieldRow(doc, 'Guest Count',      data.guestCount,      y, pageW);
      y = fieldRow(doc, 'Venue',            data.venue,           y, pageW);
      y = fieldRow(doc, 'Package Interest', data.packageInterest, y, pageW);
      y = fieldRow(doc, 'Add-Ons Interest', data.addOns,          y, pageW);
    }

    if (typeCode === 'PRT') {
      y = fieldRow(doc, 'Occasion',         data.occasion,        y, pageW);
      y = fieldRow(doc, 'Preferred Date(s)',data.preferredDates,  y, pageW, urgencyFlags.some(f => f.includes('days out')));
      y = fieldRow(doc, 'Time of Day',      data.timeOfDay,       y, pageW);
      y = fieldRow(doc, 'Location Pref.',   data.locationPref,    y, pageW);
      y = fieldRow(doc, 'Number of Subjects',data.numSubjects,    y, pageW);
      y = fieldRow(doc, 'Outfit Changes',   data.outfitChanges,   y, pageW);
    }

    if (typeCode === 'HDT') {
      y = fieldRow(doc, 'Intended Use',     data.intendedUse,     y, pageW);
      y = fieldRow(doc, 'Preferred Date(s)',data.preferredDates,  y, pageW, urgencyFlags.some(f => f.includes('days out')));
      y = fieldRow(doc, 'Time of Day',      data.timeOfDay,       y, pageW);
      y = fieldRow(doc, 'Location Pref.',   data.locationPref,    y, pageW);
      y = fieldRow(doc, 'Number of Subjects',data.numSubjects,    y, pageW);
      y = fieldRow(doc, 'Outfit Changes',   data.outfitChanges,   y, pageW);
    }

    if (typeCode === 'LST') {
      y = fieldRow(doc, 'Preferred Date(s)',data.preferredDates,  y, pageW, urgencyFlags.some(f => f.includes('days out')));
      y = fieldRow(doc, 'Time of Day',      data.timeOfDay,       y, pageW);
      y = fieldRow(doc, 'Location Pref.',   data.locationPref,    y, pageW);
      y = fieldRow(doc, 'Number of Subjects',data.numSubjects,    y, pageW);
      y = fieldRow(doc, 'Outfit Changes',   data.outfitChanges,   y, pageW);
    }

    if (typeCode === 'MAT') {
      y = fieldRow(doc, 'Due Date / Month', data.dueDate,         y, pageW);
      y = fieldRow(doc, 'Preferred Date(s)',data.preferredDates,  y, pageW, urgencyFlags.some(f => f.includes('days out')));
      y = fieldRow(doc, 'Time of Day',      data.timeOfDay,       y, pageW);
      y = fieldRow(doc, 'Location Pref.',   data.locationPref,    y, pageW);
      y = fieldRow(doc, 'Subjects',         data.numSubjects,     y, pageW);
      y = fieldRow(doc, 'Outfit Changes',   data.outfitChanges,   y, pageW);
    }

    if (typeCode === 'ENG') {
      y = fieldRow(doc, 'Partner Name',     data.partnerName,     y, pageW);
      y = fieldRow(doc, 'Preferred Date(s)',data.preferredDates,  y, pageW, urgencyFlags.some(f => f.includes('days out')));
      y = fieldRow(doc, 'Time of Day',      data.timeOfDay,       y, pageW);
      y = fieldRow(doc, 'Location Pref.',   data.locationPref,    y, pageW);
      y = fieldRow(doc, 'Outfit Changes',   data.outfitChanges,   y, pageW);
      y = fieldRow(doc, 'Adding Wedding?',  data.addWedding,      y, pageW);
    }

    if (typeCode === 'PRP') {
      y = fieldRow(doc, 'Partner Name',     data.partnerName,     y, pageW);
      y = fieldRow(doc, 'Proposal Date',    data.sessionDate,     y, pageW, urgencyFlags.some(f => f.includes('days out')));
      y = fieldRow(doc, 'Who Is Involved',  data.whoInvolved,     y, pageW);
      y = fieldRow(doc, 'Coverage Scope',   data.coverageScope,   y, pageW);
      y = fieldRow(doc, 'Photographer Role',data.photographerRole,y, pageW);
      y = fieldRow(doc, 'Cover Story',      data.coverStory,      y, pageW);
    }

    if (typeCode === 'WED') {
      y = fieldRow(doc, 'Partner Name',     data.partnerName,     y, pageW);
      y = fieldRow(doc, 'Wedding Date',     data.weddingDate,     y, pageW, urgencyFlags.some(f => f.includes('days out')));
      y = fieldRow(doc, 'Season',           data.season,          y, pageW);
      y = fieldRow(doc, 'Indoor / Outdoor', data.indoorOutdoor,   y, pageW);
      y = fieldRow(doc, 'Color Palette',    data.colorPalette,    y, pageW);
      y = fieldRow(doc, 'Guest Count',      data.guestCount,      y, pageW);
      y = fieldRow(doc, 'Wedding Party Size',data.weddingPartySize,y, pageW);
      y = fieldRow(doc, 'Ceremony Venue',   data.ceremonyVenue,   y, pageW);
      y = fieldRow(doc, 'Reception Venue',  data.receptionVenue,  y, pageW);
      y = fieldRow(doc, 'Ceremony Start',   data.ceremonyStart,   y, pageW);
      y = fieldRow(doc, 'Num. Locations',   data.numLocations,    y, pageW);
      y = fieldRow(doc, 'Portions Covered', data.portionsCovered, y, pageW);
      y = fieldRow(doc, 'Bridal Party Session', data.bridalPartySession, y, pageW);
      y = fieldRow(doc, 'Second Shooter',   data.secondShooter,   y, pageW);
      y = fieldRow(doc, 'Has Videographer', data.hasVideographer, y, pageW);
      y = fieldRow(doc, 'Coordinator',      data.coordinator,     y, pageW);
      y = fieldRow(doc, 'Adding Engagement?',data.addEngagement,  y, pageW);
    }

    if (typeCode === 'CRE') {
      y = fieldRow(doc, 'Project Type',     data.creativeType,    y, pageW);
      y = fieldRow(doc, 'Preferred Date(s)',data.preferredDates,  y, pageW, urgencyFlags.some(f => f.includes('days out')));
      y = fieldRow(doc, 'Location Pref.',   data.locationPref,    y, pageW);
      y = fieldRow(doc, 'Number of Subjects',data.numSubjects,    y, pageW);
      y = fieldRow(doc, 'Outfit Changes',   data.outfitChanges,   y, pageW);
      y = fieldRow(doc, 'Content Deadline', data.contentDeadline, y, pageW);
    }

    if (typeCode === 'RST') {
      y = fieldRow(doc, 'Property Address', data.propertyAddress, y, pageW);
      y = fieldRow(doc, 'Property Type',    data.propertyType,    y, pageW);
      y = fieldRow(doc, 'Listing Status',   data.listingStatus,   y, pageW);
      y = fieldRow(doc, 'Sq. Footage',      data.sqFootage,       y, pageW);
      y = fieldRow(doc, 'Beds / Baths',     data.bedsBaths,       y, pageW);
      y = fieldRow(doc, 'Preferred Date',   data.preferredDates,  y, pageW, urgencyFlags.some(f => f.includes('days out')));
      y = fieldRow(doc, 'Client Role',      data.clientRole,      y, pageW);
      y = fieldRow(doc, 'Brokerage',        data.brokerage,       y, pageW);
      y = fieldRow(doc, 'Services Needed',  data.servicesNeeded,  y, pageW);
      y = fieldRow(doc, 'MLS Deadline',     data.mlsDeadline,     y, pageW, !!data.mlsDeadline);
      y = fieldRow(doc, 'Staging Status',   data.stagingStatus,   y, pageW);
    }

    y += 8;

    // ── BUDGET ──
    if (data.budgetRange) {
      y = sectionHeader(doc, 'Budget', y, pageW);
      y = fieldRow(doc, 'Budget Range',     data.budgetRange,     y, pageW);
      y = fieldRow(doc, 'Hard Cap',         data.hardBudgetCap,   y, pageW, !!data.hardBudgetCap && data.hardBudgetCap.toLowerCase() !== 'no');
      y += 8;
    }

    // ── NARRATIVE FIELDS ──
    y = sectionHeader(doc, 'Client Notes', y, pageW);
    y += 4;

    const narrativeMap = {
      EVT: [['Tell Me About Your Event', 'eventNarrative'], ['Specific Shots in Mind', 'specificShots']],
      PRT: [['Tell Me About Your Vision', 'sessionNarrative'], ['Specific Shots in Mind', 'specificShots']],
      HDT: [['Impression You Want to Make', 'sessionNarrative'], ['Specific Looks in Mind', 'specificShots']],
      LST: [['The Story You Want to Tell', 'sessionNarrative'], ['Specific Moments in Mind', 'specificShots']],
      MAT: [['Your Vision', 'sessionNarrative'], ['Specific Shots in Mind', 'specificShots']],
      ENG: [['About You Two', 'coupleStory'], ['Specific Shots in Mind', 'specificShots']],
      PRP: [['The Proposal Plan', 'sessionNarrative'], ['Key Moments to Capture', 'specificShots']],
      WED: [['Your Wedding Vision', 'sessionNarrative'], ['Must-Have Shots', 'specificShots']],
      CRE: [['The Concept', 'sessionNarrative'], ['Mood & Aesthetic References', 'moodReferences'], ['Specific Shots in Mind', 'specificShots']],
      RST: [['Property Notes', 'sessionNarrative']],
      GEN: [['Their Question', 'sessionNarrative']],
      OTH: [['What They\'re Looking For', 'sessionNarrative']],
    };

    const fields = narrativeMap[typeCode] || [['Details', 'sessionNarrative']];
    fields.forEach(([label, key]) => {
      if (data[key]) {
        y = narrativeField(doc, label, data[key], y, pageW);
        // Page break if needed
        if (y > pageH - 80) { doc.addPage(); y = 48; }
      }
    });

    // ── FOOTER ──
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      drawRect(doc, 0, pageH - 36, pageW, 36, COLORS.dark);
      setFill(doc, COLORS.muted);
      doc.font('Helvetica').fontSize(7).text(
        `${refNumber}  ·  DSM Photography  ·  dsmphotography21@gmail.com  ·  @DSM_Photography`,
        48, pageH - 22, { width: pageW - 200 }
      );
      setFill(doc, COLORS.muted);
      doc.font('Helvetica').fontSize(7).text(
        `Page ${i + 1} of ${totalPages}`,
        pageW - 100, pageH - 22, { width: 52, align: 'right' }
      );
    }

    doc.end();
  });
}

// ── CLIENT CONFIRMATION PDF ─────────────────────────────────────────────────
async function buildClientPDF(data, refNumber, typeCode) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true });

    doc.on('data',  chunk => chunks.push(chunk));
    doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
    doc.on('error', err   => reject(err));

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const badgeColor = COLORS[typeCode] || COLORS.GEN;

    // ── WARM WHITE BACKGROUND ──
    drawRect(doc, 0, 0, pageW, pageH, COLORS.warmWhite);

    // ── TOP GOLD STRIPE ──
    drawRect(doc, 0, 0, pageW, 6, COLORS.gold);

    // ── HEADER ──
    setFill(doc, COLORS.dark);
    doc.font('Helvetica-Bold').fontSize(22).text('DSM PHOTOGRAPHY', 48, 40, { characterSpacing: 3 });

    setFill(doc, COLORS.muted);
    doc.font('Helvetica').fontSize(8).text('INQUIRY CONFIRMATION', 48, 70, { characterSpacing: 2 });

    // Badge
    drawRect(doc, pageW - 180, 38, 132, 20, badgeColor);
    setFill(doc, COLORS.dark);
    doc.font('Helvetica-Bold').fontSize(7).text(
      TYPE_LABELS[typeCode] || 'Inquiry',
      pageW - 180, 44, { width: 132, align: 'center', characterSpacing: 1 }
    );

    // Gold rule
    setStroke(doc, COLORS.gold);
    doc.moveTo(48, 92).lineTo(pageW - 48, 92).lineWidth(1).stroke();

    // ── GREETING ──
    let y = 112;
    setFill(doc, COLORS.dark);
    doc.font('Helvetica').fontSize(13)
       .text(`Hi ${data.firstName || 'there'} —`, 48, y);
    y += 28;

    setFill(doc, COLORS.muted);
    doc.font('Helvetica').fontSize(10).lineGap(4)
       .text(
         `Thank you for reaching out. I've received your inquiry and will be in touch within 48 hours to talk through next steps.`,
         48, y, { width: pageW - 96 }
       );
    y += 52;

    // ── YOUR INQUIRY BOX ──
    drawRect(doc, 48, y, pageW - 96, 18, COLORS.dark);
    setFill(doc, COLORS.gold);
    doc.font('Helvetica-Bold').fontSize(7.5)
       .text('YOUR INQUIRY SUMMARY', 60, y + 5, { characterSpacing: 1.5 });
    y += 26;

    // Summary fields — client-facing, clean subset
    const clientFields = [
      ['Reference Number', refNumber],
      ['Name',             `${data.firstName || ''} ${data.lastName || ''}`.trim()],
      ['Email',            data.email],
      ['Inquiry Type',     TYPE_LABELS[typeCode]],
      ['Date Submitted',   new Date().toLocaleDateString('en-US', { dateStyle: 'long' })],
    ];

    // Add the key date if present
    const dateVal = data.eventDate || data.weddingDate || data.sessionDate || data.preferredDates;
    if (dateVal) clientFields.push(['Date of Interest', dateVal]);

    // Package if present
    if (data.packageInterest) clientFields.push(['Package Interest', data.packageInterest]);

    clientFields.forEach(([label, value]) => {
      if (!value) return;
      const labelW = 160;
      setFill(doc, COLORS.muted);
      doc.font('Helvetica').fontSize(8.5).text(label, 60, y, { width: labelW });
      setFill(doc, COLORS.dark);
      doc.font('Helvetica-Bold').fontSize(8.5).text(value, 60 + labelW, y, { width: pageW - 60 - labelW - 60 });
      y += 18;
    });

    y += 20;

    // ── WHAT HAPPENS NEXT ──
    setStroke(doc, COLORS.goldLight);
    doc.moveTo(48, y).lineTo(pageW - 48, y).lineWidth(0.5).stroke();
    y += 16;

    setFill(doc, COLORS.dark);
    doc.font('Helvetica-Bold').fontSize(8).text('WHAT HAPPENS NEXT', 48, y, { characterSpacing: 1.5 });
    y += 18;

    const steps = [
      ['Within 48 hours',  'I\'ll review your inquiry and reach out by your preferred contact method to confirm details and answer any questions.'],
      ['To hold your date', 'A 50% deposit is required within 48 hours of signing your contract. Your date is not held until the deposit is received.'],
      ['Questions in the meantime', 'Feel free to reply to this confirmation email or reach out at dsmphotography21@gmail.com.'],
    ];

    steps.forEach(([title, body]) => {
      drawRect(doc, 48, y, 4, 28, COLORS.gold);
      setFill(doc, COLORS.dark);
      doc.font('Helvetica-Bold').fontSize(8.5).text(title, 62, y + 2, { width: pageW - 110 });
      setFill(doc, COLORS.muted);
      doc.font('Helvetica').fontSize(8).text(body, 62, y + 14, { width: pageW - 110 });
      y += 42;
    });

    y += 16;

    // ── CLOSING ──
    setFill(doc, COLORS.dark);
    doc.font('Helvetica').fontSize(10).text('Talk soon,', 48, y);
    y += 18;
    doc.font('Helvetica-Bold').fontSize(11).text('Dayna S. McKenzie', 48, y);
    y += 14;
    setFill(doc, COLORS.gold);
    doc.font('Helvetica').fontSize(8.5).text('DSM Photography', 48, y);

    // ── BOTTOM STRIPE ──
    drawRect(doc, 0, pageH - 48, pageW, 48, COLORS.dark);
    setFill(doc, COLORS.muted);
    doc.font('Helvetica').fontSize(7.5).text(
      'dsmphotography21@gmail.com  ·  @DSM_Photography  ·  Miami, FL',
      48, pageH - 28, { width: pageW - 96, align: 'center' }
    );

    doc.end();
  });
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);

    // Map inquiry type to type code
    const typeCodeMap = {
      'event':       'EVT',
      'portrait':    'PRT',
      'headshot':    'HDT',
      'lifestyle':   'LST',
      'maternity':   'MAT',
      'engagement':  'ENG',
      'proposal':    'PRP',
      'wedding':     'WED',
      'creative':    'CRE',
      'realestate':  'RST',
      'general':     'GEN',
      'other':       'OTH',
    };

    const typeCode = typeCodeMap[data.inquiryType] || 'GEN';

    // Reference number — use sequence from client (stored in localStorage)
    const sequence = parseInt(data.sequenceNumber || '1000', 10);
    const refNumber = generateRefNumber(typeCode, sequence);

    // Generate both PDFs
    const [internalPDF, clientPDF] = await Promise.all([
      buildInternalPDF(data, refNumber, typeCode),
      buildClientPDF(data, refNumber, typeCode),
    ]);

    // Send via SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const fromEmail = { email: 'dsmphotography21@gmail.com', name: 'DSM Photography' };

    // Email to Dayna (internal)
    const internalMsg = {
      to:      'dsmphotography21@gmail.com',
      from:    fromEmail,
      subject: `[${typeCode}] New Inquiry — ${data.firstName || ''} ${data.lastName || ''} · ${refNumber}`,
      html: `
        <div style="font-family: sans-serif; font-size: 14px; color: #100f09;">
          <p>New inquiry received. See attached PDF for full details.</p>
          <p><strong>Reference:</strong> ${refNumber}<br>
             <strong>Name:</strong> ${data.firstName} ${data.lastName}<br>
             <strong>Email:</strong> ${data.email}<br>
             <strong>Type:</strong> ${TYPE_LABELS[typeCode]}</p>
        </div>
      `,
      attachments: [{
        content:     internalPDF.toString('base64'),
        filename:    `${refNumber}-intake.pdf`,
        type:        'application/pdf',
        disposition: 'attachment',
      }],
    };

    // Email to client (confirmation)
    const clientMsg = {
      to:      data.email,
      from:    fromEmail,
      subject: `Your inquiry is received — ${refNumber} · DSM Photography`,
      html: `
        <div style="font-family: sans-serif; font-size: 14px; color: #100f09; max-width: 480px;">
          <p>Hi ${data.firstName || 'there'},</p>
          <p>Thank you for reaching out to DSM Photography. I've received your inquiry and will be in touch within <strong>48 hours</strong>.</p>
          <p>Your reference number is <strong>${refNumber}</strong>. Your full inquiry summary is attached as a PDF — save it for your records.</p>
          <p>Talk soon,<br><strong>Dayna S. McKenzie</strong><br>DSM Photography</p>
        </div>
      `,
      attachments: [{
        content:     clientPDF.toString('base64'),
        filename:    `DSM-Inquiry-Confirmation-${refNumber}.pdf`,
        type:        'application/pdf',
        disposition: 'attachment',
      }],
    };

    await Promise.all([
      sgMail.send(internalMsg),
      sgMail.send(clientMsg),
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, refNumber }),
    };

  } catch (err) {
    console.error('submit-inquiry error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
