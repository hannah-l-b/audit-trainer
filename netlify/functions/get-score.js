// netlify/functions/get-score.js
// Returns the participant_score for a given participant_id from results_prolific

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const pid = event.queryStringParameters?.pid;
  if (!pid) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing pid' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server misconfiguration' }) };
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/results_prolific?participant_id=eq.${encodeURIComponent(pid)}&select=final_score,participant_score,manager_score,combined_score,condition&limit=1`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    });

    const rows = await res.json();
    console.log('Supabase status:', res.status);
    console.log('Rows returned:', JSON.stringify(rows));
    if (!rows.length) {
      return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ found: false }) };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
          found: true,
          final_score: rows[0].final_score,
          participant_score: rows[0].participant_score,
          manager_score: rows[0].manager_score,
          combined_score: rows[0].combined_score,
          condition: rows[0].condition
        })
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
