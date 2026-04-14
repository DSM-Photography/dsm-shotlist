const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = event.queryStringParameters?.token;
  if (!token) {
    return { statusCode: 400, body: JSON.stringify({ error: 'token is required' }) };
  }

  const supabase = getSupabase();

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('portal_token', token)
    .single();

  if (error) {
    const notFound = error.code === 'PGRST116';
    return {
      statusCode: notFound ? 404 : 500,
      body: JSON.stringify({ error: notFound ? 'Booking not found.' : error.message })
    };
  }

  // Also check if contracts have been signed
  const { data: contracts } = await supabase
    .from('contracts')
    .select('contract_type, signed_at, status')
    .eq('booking_id', booking.id);

  // Check if shot list submitted
  const { data: shotList } = await supabase
    .from('shot_lists')
    .select('id, submitted_at')
    .eq('booking_id', booking.id)
    .maybeSingle();

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking,
      contracts: contracts || [],
      shot_list: shotList || null
    })
  };
};
