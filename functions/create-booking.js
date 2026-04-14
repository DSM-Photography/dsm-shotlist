const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
}

function generatePortalToken() {
  return crypto.randomBytes(24).toString('hex'); // 48-char hex string
}

function padInvoiceNumber(n) {
  return `DSM-INV-${String(n).padStart(4, '0')}`;
}

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

  const {
    inquiry_id,
    ref_number,
    client_name,
    client_email,
    client_phone,
    service_type,
    package_name,
    session_date,
    session_time,
    venue,
    contract_total,
    deposit_amount,
    balance_due,
    notes
  } = body;

  // Required fields check
  if (!inquiry_id || !ref_number || !client_email || !contract_total) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: inquiry_id, ref_number, client_email, contract_total' })
    };
  }

  const supabase = getSupabase();

  // --- Auto-increment invoice number ---
  // Get the highest existing invoice number from bookings
  const { data: existingBookings, error: fetchError } = await supabase
    .from('bookings')
    .select('invoice_number')
    .order('id', { ascending: false })
    .limit(20); // small buffer to find highest

  if (fetchError) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Failed to fetch bookings for invoice numbering: ${fetchError.message}` })
    };
  }

  let nextInvoiceNum = 1;
  if (existingBookings && existingBookings.length > 0) {
    const parsed = existingBookings
      .map(b => {
        if (!b.invoice_number) return 0;
        const match = b.invoice_number.match(/DSM-INV-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => !isNaN(n));
    if (parsed.length > 0) {
      nextInvoiceNum = Math.max(...parsed) + 1;
    }
  }

  const invoice_number = padInvoiceNumber(nextInvoiceNum);
  const portal_token = generatePortalToken();

  // --- Insert booking record ---
  const { data: booking, error: insertError } = await supabase
    .from('bookings')
    .insert([{
      inquiry_id,
      ref_number,
      invoice_number,
      client_name,
      client_email,
      client_phone,
      service_type,
      package_name,
      session_date,
      session_time,
      venue,
      contract_total: parseFloat(contract_total),
      deposit_amount: parseFloat(deposit_amount),
      balance_due: parseFloat(balance_due),
      portal_token,
      status: 'active',
      notes: notes || ''
    }])
    .select()
    .single();

  if (insertError) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Failed to create booking: ${insertError.message}` })
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: true,
      booking_id: booking.id,
      invoice_number,
      portal_token,
      portal_url: `https://dsmphotolab.com/portal?token=${portal_token}`
    })
  };
};
