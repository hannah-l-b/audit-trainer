const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const headers = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const participantId = event.queryStringParameters?.pid;
  if (!participantId) {
    return { statusCode: 400, headers, body: JSON.stringify({ completed: false }) };
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/results?participant_id=eq.${participantId}&select=participant_id`,
      {
        headers: {
          "apikey":        SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type":  "application/json"
        }
      }
    );

    const data = await response.json();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ completed: data && data.length > 0 })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ completed: false, error: err.message })
    };
  }
};
