// netlify/functions/save-paste.js
// Upserts paste count for a participant + control into chat_sessions.
// Called directly from the Teams chat iframe on each paste event.

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { participantId, controlIndex, pasteCount } = JSON.parse(event.body);

    if (!participantId || participantId === 'N/A') {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing participantId' }) };
    }

    // PATCH only — updates paste_count on the existing row without creating a new one.
    // manager-reply creates the row when a message is sent; save-paste only updates it.
    // This avoids conflicts where a paste-only INSERT blocks the later messages upsert.
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_sessions?participant_id=eq.${encodeURIComponent(participantId)}&control_index=eq.${controlIndex}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({ paste_count: pasteCount }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('save-paste Supabase error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err }) };
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.error('save-paste error:', err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
