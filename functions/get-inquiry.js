const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const refNumber = event.queryStringParameters?.ref_number;

  if (!refNumber) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'ref_number query parameter is required' })
    };
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .eq('ref_number', refNumber.trim())
    .single();

  if (error) {
    const notFound = error.code === 'PGRST116';
    return {
      statusCode: notFound ? 404 : 500,
      body: JSON.stringify({
        error: notFound ? `No inquiry found for ref# ${refNumber}` : error.message
      })
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inquiry: data })
  };
};
