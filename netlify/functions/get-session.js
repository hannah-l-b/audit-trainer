// netlify/functions/get-session.js
// Returns saved messages for a specific participant + control_index.
// Used by the control chat on load to restore conversationHistory
// in case the page reloaded after a previous message was sent.

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const pid     = event.queryStringParameters?.pid;
  const control = event.queryStringParameters?.control;

  if (!pid || control === undefined) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: 'Missing pid or control' })
    };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Server misconfiguration' })
    };
  }

  try {
    // Get the most recently updated row for this participant + control.
    // order=updated_at.desc handles the edge case where multiple rows exist.
    const url = `${SUPABASE_URL}/rest/v1/chat_sessions`
      + `?participant_id=eq.${encodeURIComponent(pid)}`
      + `&control_index=eq.${control}`
      + `&select=messages`
      + `&order=updated_at.desc`
      + `&limit=1`;

    const res = await fetch(url, {
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    });

    const rows = await res.json();
    console.log('get-session status:', res.status, 'rows found:', rows.length);

    if (!rows.length || !rows[0].messages || !rows[0].messages.length) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ found: false })
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ found: true, messages: rows[0].messages })
    };

  } catch (err) {
    console.error('get-session error:', err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
