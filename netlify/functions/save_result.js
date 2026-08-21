// netlify/functions/save-result.js
// Receives game data from both versions and saves to Supabase
//
// SETUP (one time only):
// 1. Go to supabase.com and create a free account
// 2. Create a new project (name it anything, e.g. "audit-training")
// 3. Go to Table Editor → New Table → name it "results" → enable RLS: OFF
// 4. Add these columns (all text type unless noted):
//      id            → int8, primary key, auto-increment (created by default)
//      created_at    → timestamptz (created by default)
//      condition     → text
//      participant_id → text
//      final_score   → int8
//      correct_answers → int8
//      total_questions → int8
//      accuracy      → int8
//      max_streak    → int8
//      total_time    → int8
//      timed_out_count → int8
//      question_log  → jsonb
// 5. Go to Project Settings → API
// 6. Copy "Project URL" and paste below as SUPABASE_URL
// 7. Copy "anon public" key and paste below as SUPABASE_ANON_KEY

const SUPABASE_URL      = "YOUR_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY_HERE";

const headers = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

exports.handler = async function(event) {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const data = JSON.parse(event.body);

    const row = {
      condition:        data.condition,
      participant_id:   data.participantId || "N/A",
      final_score:      data.finalScore,
      correct_answers:  data.correctAnswers,
      total_questions:  data.totalQuestions,
      accuracy:         data.accuracy,
      max_streak:       data.maxStreak,
      total_time:       data.totalTime,
      timed_out_count:  data.timedOut,
      question_log:     data.questions  // stored as JSON
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/results`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer":        "return=minimal"
      },
      body: JSON.stringify(row)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Supabase error ${response.status}: ${err}`);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ result: "success" }) };

  } catch (err) {
    console.error("save-result error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ result: "error", message: err.message })
    };
  }
};
