// netlify/functions/get-history.js
// Returns saved conversation history for a given participant + control

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const pid          = event.queryStringParameters?.pid;
  const controlIndex = event.queryStringParameters?.control;

  if (!pid || controlIndex === undefined) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing pid or control' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server misconfiguration' }) };
  }

  try {
    // Fetch ALL sessions for this participant where control_index >= 0, ordered by control_index.
    // We merge them into one continuous conversation so history carries across controls.
    // Sessions with control_index < 0 (intro chat) are excluded from the control chat view.
    const url = `${SUPABASE_URL}/rest/v1/chat_sessions?participant_id=eq.${encodeURIComponent(pid)}&control_index=gte.0&select=messages,control_index,created_at&order=created_at.asc`;
    const res = await fetch(url, {
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    });

    const rows = await res.json();
    console.log('get-history status:', res.status, 'rows:', rows.length);

    if (!rows.length) {
      return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ found: false }) };
    }

    // Merge ALL sessions for this participant in control_index order.
    // No ceiling filter — Qualtrics may use any numbering scheme.
    const merged = rows.flatMap(r => r.messages || []);

    if (!merged.length) {
      return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ found: false }) };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ found: true, messages: merged })
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
