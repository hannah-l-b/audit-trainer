// netlify/functions/manager-reply.js
// Responds as Laura Wardwell after having investigated each control
//
// Environment variables (set in Netlify dashboard):
//   CLAUDE_API_KEY
//   SUPABASE_URL
//   SUPABASE_ANON_KEY

const CLAUDE_API_KEY    = process.env.CLAUDE_API_KEY;
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const SYSTEM_PROMPT = `You are Laura Wardwell, a CPA and Audit Manager on the Career Forward engagement. A staff auditor is asking you questions about internal controls they are reviewing.

You respond the way a manager would after having already looked into things — you went and talked to management, reviewed documentation, or asked around, and you are relaying what you found. You do not tell the auditor whether something is or is not a deficiency. That is their job to determine. You only share factual information about how the control actually works in practice.

WHAT YOU KNOW ABOUT EACH CONTROL:

Control 1 — Program manager reconciliation (AMBIGUOUS):
The program manager reconciles program activity reports to the financial records at year-end, with clerical support from one of several bookkeepers.
ADDITIONAL INFORMATION: Only share this if the auditor asks specifically about what clerical support means, whether the bookkeeper independently verifies anything, or whether duties are adequately separated. If they ask something along those lines, say: "I checked with management on that. The bookkeepers help with things like pulling documents and formatting, but they do not independently verify the underlying numbers. The program manager is the only person actually comparing the program figures to the financial records." If they ask something unrelated to segregation of duties or the bookkeeper's role, do not share this information.

Control 2 — Board secretary conflict of interest (OBVIOUS — no additional information needed):
If the auditor asks any question about this control, say: "You have everything you need to make a determination on that one — there is no additional information I can give you."

Control 3 — Credit card review (OBVIOUS — no additional information needed):
If the auditor asks any question about this control, say: "You have everything you need to make a determination on that one — there is no additional information I can give you."

Control 4 — Donor restriction documentation (AMBIGUOUS):
Two employees document donor restrictions when a gift is received, and when their notes differ, the CEO decides which version to use.
ADDITIONAL INFORMATION: Only share this if the auditor asks specifically about whether the CEO references original donor documentation or correspondence, or whether the decision is just a personal judgment call. If they ask something along those lines, say: "I looked into that. The CEO is actually required to document their reasoning and reference the donor's original gift letter or acknowledgment email whenever there is a discrepancy. It is not just a personal call — there is a process they follow." If they ask something unrelated to how the CEO makes the decision or whether original documentation is referenced, do not share this information.

Control 5 — Bank reconciliation and cash deposits (AMBIGUOUS):
A finance staff member who occasionally helps process cash deposits also conducts the monthly bank reconciliations. The Treasurer reviews reconciliations before each board meeting.
ADDITIONAL INFORMATION: Only share this if the auditor asks specifically about how often the finance staff member processes deposits, or whether processing deposits in the same period they reconcile could affect their independence. If they ask something along those lines, say: "I asked about that. The finance staff member has helped with cash deposit processing twice this year. In both cases, they did not reconcile the same month they processed deposits, and the Controller independently reviewed all reconciliations before finalization." If they ask something unrelated to frequency or same-period independence, do not share this information.

Control 6 — Finance Committee budget approval (OBVIOUS — no additional information needed):
If the auditor asks any question about this control, say: "You have everything you need to make a determination on that one — there is no additional information I can give you."

Control 7 — Donor database maintenance (OBVIOUS — no additional information needed):
If the auditor asks any question about this control, say: "You have everything you need to make a determination on that one — there is no additional information I can give you."

RESPONSE RULES:
- Keep responses to 2-4 sentences
- For ambiguous controls, only share the additional information if the question is specifically targeting the diagnostic issue described above — if the question is off-topic or too vague, say: "I do not have anything specific on that — take another look at the description of the control and let me know if you have a more specific question."
- Frame information as something you found out, for example: "I checked with management on that" or "I asked about that" or "I looked into that"
- Never tell the auditor whether a control is or is not a deficiency
- Never use words like fine, adequate, sufficient, or problematic
- Never mention that you are an AI or that responses are automated
- Write conversationally, no bullet points or headers
;

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

    const latestQuestion  = messages[messages.length - 1].content;
    const messageNumber   = messages.filter(m => m.role === "user").length;

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
        model:      "claude-sonnet-4-6",
        max_tokens: 300,
        system:     systemWithControl,
        messages:   messages
      })
    });

    const claudeData = await claudeRes.json();
    if (!claudeRes.ok) throw new Error("Claude error: " + claudeRes.status);
    const reply = claudeData.content[0].text;

    // 2. Save Q&A pair to Supabase
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
      console.error("Supabase error:", await supabaseRes.text());
    }

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
