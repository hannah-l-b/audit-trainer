// netlify/functions/check-completion.js
// Checks Supabase to see if a participant has completed the game

const SUPABASE_URL      = process.env.SUPABASE_URL_GAME;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY_GAME;

const headers = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const participantId = event.queryStringParameters && event.queryStringParameters.pid;

  if (!participantId) {
    return { statusCode: 400, headers, body: JSON.stringify({ completed: false, error: "No pid provided" }) };
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/results?participant_id=eq.${encodeURIComponent(participantId)}&select=participant_id`,
      {
        headers: {
          "apikey":        SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type":  "application/json"
        }
      }
    );

    const data = await response.json();
    console.log("pid:", participantId, "rows found:", data.length, "data:", JSON.stringify(data));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ completed: data && data.length > 0 })
    };

  } catch (err) {
    console.error("check-completion error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ completed: false, error: err.message })
    };
  }
};
