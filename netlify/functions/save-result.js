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
//      question_order → jsonb
//      partner_score →  int8
//      combined_score → int8
//      tab_switches  → int8
//      time_away_ms  → int8
//      leaderboard_scores → jsonb   ← NEW: array of all scores on the leaderboard
//      group_average      → int8    ← NEW: computed average of leaderboard_scores
//      above_average      → bool    ← NEW: true if participant score >= group average
// 5. Go to Project Settings → API
// 6. Copy "Project URL" and paste below as SUPABASE_URL
// 7. Copy "anon public" key and paste below as SUPABASE_ANON_KEY

const SUPABASE_URL      = process.env.SUPABASE_URL_GAME;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY_GAME;

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

    // --- Compute above_average from leaderboard scores ---
    // leaderboardScores: array of all scores on the board, including the participant.
    // For comp: [participantScore, peer1, peer2, peer3, peer4, peer5]
    // For team: [combinedScore, aiTeam1, aiTeam2, aiTeam3, aiTeam4, aiTeam5]
    let groupAverage = null;
    let aboveAverage = null;
    if (Array.isArray(data.leaderboardScores) && data.leaderboardScores.length > 0) {
      const scores = data.leaderboardScores.map(Number).filter(n => !isNaN(n));
      if (scores.length > 0) {
        groupAverage = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        // For comp use finalScore; for team use combinedScore
        const participantScore = data.combinedScore ?? data.finalScore ?? null;
        if (participantScore !== null) {
          aboveAverage = participantScore >= groupAverage;
        }
      }
    }

    const row = {
      condition:          data.condition,
      participant_id:     data.participantId || "N/A",
      final_score:        data.finalScore,
      correct_answers:    data.correctAnswers,
      total_questions:    data.totalQuestions,
      accuracy:           data.accuracy,
      max_streak:         data.maxStreak,
      total_time:         data.totalTime,
      timed_out_count:    data.timedOut,
      question_log:       data.questions,       // stored as JSON
      question_order:     data.questionOrder,   // original indices in order shown
      partner_score:      data.partnerScore || data.managerScore || null,
      combined_score:     data.combinedScore || null,
      tab_switches:       data.tabSwitches ?? 0,
      time_away_ms:       data.timeAwayMs ?? 0,
      leaderboard_scores: data.leaderboardScores || null,
      group_average:      groupAverage,
      above_average:      aboveAverage,
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/results_prolific`, {
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

    // Return aboveAverage so the game can pass it straight to intro-reply
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ result: "success", aboveAverage, groupAverage })
    };

  } catch (err) {
    console.error("save-result error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ result: "error", message: err.message })
    };
  }
};
