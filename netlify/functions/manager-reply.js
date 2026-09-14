// netlify/functions/manager-reply.js
// Gets Laura's reply from Claude and saves each Q&A exchange to Supabase
//
// Supabase table: questions
// Columns:
//   id              int8, auto-increment, primary key
//   created_at      timestamptz (auto)
//   participant_id  text
//   condition       text
//   control_index   int8
//   control_name    text
//   message_number  int8   (1st question = 1, 2nd = 2, etc.)
//   question        text
//   reply           text
//
// Environment variables (set in Netlify dashboard):
//   CLAUDE_API_KEY
//   SUPABASE_URL
//   SUPABASE_ANON_KEY

const CLAUDE_API_KEY    = process.env.CLAUDE_API_KEY;
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const SYSTEM_PROMPT = `You are Laura Wardwell, a CPA and audit manager overseeing a nonprofit audit engagement for Career Forward, a workforce development nonprofit. A staff auditor is asking you questions about internal controls they are reviewing.

Respond naturally and professionally as a manager would. You have the following information about the engagement:

WHAT YOU KNOW:
- Career Forward has been operating since 1998 with generally stable finances
- They recently received a one-time federal grant of $400,000 which inflated current year figures
- An internal controls review found significant deficiencies (not material weaknesses) related to expense allocation between program, administrative, and fundraising categories
- The grants manager internally flags uncertain expenses but these flags are not formally communicated to the Executive Director before submission
- The board secretary's spouse serves on the advisory board of a major corporate sponsor
- A government funding agency compliance review found no significant issues with prior grant fund allocation

WHAT YOU DO NOT KNOW OR WILL NOT SHARE:
- Any information not listed above
- The correct answer to any control assessment
- Whether a specific control is or is not a deficiency

RESPONSE RULES:
- Keep responses to 2-4 sentences maximum
- Respond only to what was asked, do not volunteer extra information
- If asked something outside your knowledge, say: I do not have that information in front of me right now
- If asked something unrelated to the audit task, politely redirect
- Never mention that you are an AI or that responses are automated
- Write conversationally, no bullet points or headers
- Always sign off with:

Laura Wardwell, CPA
Audit Manager | Career Forward Engagement Team`;

const headers = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const {
      messages,
      currentControl,
      controlIndex,
      participantId,
      condition
    } = JSON.parse(event.body);

    // The latest participant message is always the last one
    const latestQuestion = messages[messages.length - 1].content;
    // Message number = how many user messages are in the history
    const messageNumber = messages.filter(m => m.role === "user").length;

    const systemWithControl = SYSTEM_PROMPT +
      "\n\nThe staff auditor is currently reviewing: " + (currentControl || "an internal control");

    // 1. Get Claude reply
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model:    "claude-sonnet-4-6",
        max_tokens: 300,
        system:   systemWithControl,
        messages: messages
      })
    });

    const claudeData = await claudeRes.json();
    if (!claudeRes.ok) throw new Error("Claude error: " + claudeRes.status);
    const reply = claudeData.content[0].text;

    // 2. Save Q&A pair to Supabase — one row per exchange
    const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/questions`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer":        "return=minimal"
      },
      body: JSON.stringify({
        participant_id:  participantId  || "N/A",
        condition:       condition      || "N/A",
        control_index:   controlIndex   || 0,
        control_name:    currentControl || "N/A",
        message_number:  messageNumber,
        question:        latestQuestion,
        reply:           reply
      })
    });

    if (!supabaseRes.ok) {
      const err = await supabaseRes.text();
      console.error("Supabase error:", err);
      // Still return reply even if save fails
    }

    // 3. Return reply and updated messages for client-side history
    const updatedMessages = [...messages, { role: "assistant", content: reply }];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply, updatedMessages })
    };

  } catch (err) {
    console.error("manager-reply error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
