const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
}

function padInvoiceNumber(n) {
  return `DSM-INV-${String(n).padStart(4, '0')}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('bookings')
    .select('invoice_number')
    .order('id', { ascending: false })
    .limit(20);

  if (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }

  let next = 1;
  if (data && data.length > 0) {
    const nums = data
      .map(b => {
        const match = b.invoice_number?.match(/DSM-INV-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => !isNaN(n));
    if (nums.length > 0) next = Math.max(...nums) + 1;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice_number: padInvoiceNumber(next) })
  };
};
