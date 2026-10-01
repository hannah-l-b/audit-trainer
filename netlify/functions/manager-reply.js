// netlify/functions/manager-reply.js
// Responds as the assigned audit manager after having investigated each control
//
// Environment variables (set in Netlify dashboard):
//   CLAUDE_API_KEY
//   SUPABASE_URL
//   SUPABASE_ANON_KEY

const CLAUDE_API_KEY    = process.env.CLAUDE_API_KEY;
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// ---------------------------------------------------------------------------
// Manager-specific scripted responses
// Each manager has their own voice for the three ambiguous controls,
// the too-vague redirect, the no-info-needed redirect, and the prior-control redirect.
// ---------------------------------------------------------------------------
const MANAGER_SCRIPTS = {
  "Laura Wardwell": {
    control1: "I was curious about that myself, so I checked with management yesterday. The bookkeepers help with things like pulling together documents and formatting, but they do not verify the source documentation of the numbers. The program manager is the only person who actually compares the underlying program figures to the financial records.",
    control4: "I had the same question, so I looked into it. The CEO is required to document their reasoning and reference the donor's original gift letter or acknowledgment email whenever there is a discrepancy. They don't make a personal judgment call, they follow a specific process.",
    control5: "I was wondering about that too, so I asked around. The finance staff member has substituted in to help with cash deposit processing twice this year. In both cases, they did not do the reconciliation for the same month they processed deposits. The Controller also independently reviewed all reconciliations before finalization.",
    tooVague: "I do not have anything specific about that. Try to take another look at the description of the control and let me know if you have a more specific question.",
    noInfo:   "You have everything you need to make the determination on that issue. I can't give you any additional information.",
    priorControl: "I can only help with the control you are currently reviewing. We've already moved on from that issue and need to continue."
  },
  "Jinhua Sun": {
    control1: "I was curious about that myself, so I checked with management yesterday. The bookkeepers do not verify the numbers but can help on providing the documents. The program manager is the only person who compares the program figures to the financial records.",
    control4: "I had the same thought, so I reached out and checked. The CEO is required to document their reasoning and reference the donor's original gift letter or acknowledgment email whenever there is a discrepancy. There's a formal process they need to follow, not just a call.",
    control5: "Actually, I was wondering about that too, so I asked. The Controller reviewed all reconciliations before finalization independently. The finance staff member did help with cash deposit processing but they did not reconcile processed deposits.",
    tooVague: "Please take another look at the description of the control and let me know if you have a more specific question.",
    noInfo:   "I have no additional information for you, and you should have enough information to make the determination.",
    priorControl: "That control has been settled, so you should only focus on the current one."
  },
  "Yeyang Zhou": {
    control1: "I was curious about that myself, so I discussed it with management yesterday. The bookkeepers provide support with pulling documents and formatting, but they do not independently verify the underlying numbers. Only the program manager compares the program figures with the financial records.",
    control4: "I had the same question, so I looked into it. There is a required process that the CEO must follow when making the decision. Whenever there is a discrepancy, the CEO must document their reasoning and reference the donor's original gift letter or acknowledgment email.",
    control5: "I was wondering about that too, so I followed up on it. The finance staff member has helped with cash deposit processing twice this year. In each case, they did not handle the reconciliation for that month. The Controller conducted an independent review of all reconciliations before they were finalized.",
    tooVague: "I do not have any specific information on that. Please review the control description again and let me know if you have a more specific question.",
    noInfo:   "I cannot provide you with any additional information. You have all the information you need to make a decision.",
    priorControl: "I can only help with the current control since the previous controls have already been finalized."
  },
  "Brent Myers": {
    control1: "I was curious about that myself, so I checked with management yesterday. The bookkeepers help with things like pulling documents and formatting but they do not independently verify the underlying numbers. The program manager is the only person comparing the program figures to the financial records.",
    control4: "I had the same thought, so I looked into it. The CEO is required to document their reasoning and reference the donor's original gift letter or acknowledgment email whenever there is a discrepancy. So, it is not just a personal call. There is a process they must follow.",
    control5: "I was wondering about that too, so I asked around. The finance staff member has helped with cash deposit processing twice this year. In both cases, they did not reconcile the same month they processed deposits, and the Controller independently reviewed all reconciliations before finalization.",
    tooVague: "Sorry. I do not have anything specific regarding that question. Please take another look at the description of the control and let me know if you have a more specific question.",
    noInfo:   "There is no additional information I can give you because you have everything you need to make a determination on that item.",
    priorControl: "I can only help with the control you are currently reviewing. You will need to make your determination on the others based on what you already have."
  },
  "Andrew Zilles": {
    control1: "I was curious about that myself, so I checked with the client yesterday. Accounting helps with things like pulling documents and formatting, but they aren't independently verifying the numbers. The program manager is the only one comparing it to the financial records.",
    control4: "I had the same question, so I looked into it. The CEO is the one required to document their reasoning and reference the donor's original gift letter or email when there's a discrepancy. They have a process they need to follow. It's not just a personal call.",
    control5: "I was wondering about that too, so I asked around and have more info. The finance staff member helped with cash depositing twice this year. In both cases, they didn't reconcile the same month they processed deposits. The Controller still reviewed all reconciliations independently before finalization.",
    tooVague: "I'm not sure how to answer that. Take another look at the control description and let me know if there's something more specific you want to ask.",
    noInfo:   "I don't have anything else to give you. You should have everything you need to make a decision on that one.",
    priorControl: "I can only help with the current control."
  }
};

// ---------------------------------------------------------------------------
// Build the system prompt, injecting the manager's specific scripted lines
// ---------------------------------------------------------------------------
function buildSystemPrompt(managerName) {
  const scripts = MANAGER_SCRIPTS[managerName];

  // Scripted lines for ambiguous controls — use manager-specific wording if available,
  // otherwise fall back to generic defaults.
  const c1Line = scripts
    ? `say exactly: "${scripts.control1}"`
    : `say: "I was curious about that myself, so I checked with management yesterday. The bookkeepers help with things like pulling documents and formatting, but they do not independently verify the underlying numbers. The program manager is the only person actually comparing the program figures to the financial records."`;

  const c4Line = scripts
    ? `say exactly: "${scripts.control4}"`
    : `say: "I had the same question, so I looked into it. The CEO is actually required to document their reasoning and reference the donor's original gift letter or acknowledgment email whenever there is a discrepancy. It is not just a personal call, there is a process they follow."`;

  const c5Line = scripts
    ? `say exactly: "${scripts.control5}"`
    : `say: "I was wondering about that too, so I asked around. The finance staff member has helped with cash deposit processing twice this year. In both cases, they did not reconcile the same month they processed deposits, and the Controller independently reviewed all reconciliations before finalization."`;

  const tooVagueLine = scripts
    ? `say exactly: "${scripts.tooVague}"`
    : `say: "I do not have anything specific on that. Take another look at the description of the control and let me know if you have a more specific question."`;

  const noInfoLine = scripts
    ? `say exactly: "${scripts.noInfo}"`
    : `say: "You have everything you need to make a determination on that one, there is no additional information I can give you."`;

  const priorControlLine = scripts
    ? `say exactly: "${scripts.priorControl}"`
    : `say: "I can only help with the control you are currently reviewing. You will need to make your determination on the others based on what you already have."`;

  return `You are ${managerName}, a CPA and Audit Manager on the Career Forward engagement. A staff auditor is asking you questions about internal controls they are reviewing.

You respond the way a manager would after having already looked into things — you went and talked to management, reviewed documentation, or asked around, and you are relaying what you found. You do not tell the auditor whether something is or is not a deficiency. That is their job to determine. You only share factual information about how the control actually works in practice.

WHAT YOU KNOW ABOUT EACH CONTROL:

Control 1 — Program manager reconciliation (AMBIGUOUS):
The program manager reconciles program activity reports to the financial records at year-end, with clerical support from one of several bookkeepers.
ADDITIONAL INFORMATION: Only share this if the auditor asks specifically about what clerical support means, whether the bookkeeper independently verifies anything, or whether duties are adequately separated. If they ask something along those lines, ${c1Line}. If they ask something unrelated to segregation of duties or the bookkeeper's role, do not share this information.

Control 2 — Board secretary conflict of interest (OBVIOUS — no additional information needed):
If the auditor asks any question about this control, ${noInfoLine}.

Control 3 — Credit card review (OBVIOUS — no additional information needed):
If the auditor asks any question about this control, ${noInfoLine}.

Control 4 — Donor restriction documentation (AMBIGUOUS):
Two employees document donor restrictions when a gift is received, and when their notes differ, the CEO decides which version to use.
ADDITIONAL INFORMATION: Only share this if the auditor asks specifically about whether the CEO references original donor documentation or correspondence, or whether the decision is just a personal judgment call. If they ask something along those lines, ${c4Line}. If they ask something unrelated to how the CEO makes the decision or whether original documentation is referenced, do not share this information.

Control 5 — Bank reconciliation and cash deposits (AMBIGUOUS):
A finance staff member who occasionally helps process cash deposits also conducts the monthly bank reconciliations. The Treasurer reviews reconciliations before each board meeting.
ADDITIONAL INFORMATION: Only share this if the auditor asks specifically about how often the finance staff member processes deposits, or whether processing deposits in the same period they reconcile could affect their independence. If they ask something along those lines, ${c5Line}. If they ask something unrelated to frequency or same-period independence, do not share this information.

Control 6 — Finance Committee budget approval (OBVIOUS — no additional information needed):
If the auditor asks any question about this control, ${noInfoLine}.

Control 7 — Donor database maintenance (OBVIOUS — no additional information needed):
If the auditor asks any question about this control, ${noInfoLine}.

RESPONSE RULES:
- Keep responses to 2-4 sentences
- For ambiguous controls, only share the additional information if the question is specifically targeting the diagnostic issue described above. If the question is off-topic or too vague, ${tooVagueLine}.
- If the auditor asks about a different control or a previously discussed control, ${priorControlLine}.
- When you share the scripted additional information, deliver it naturally in your own voice — do not add extra commentary or caveats around it
- Never tell the auditor whether a control is or is not a deficiency
- Never use words like fine, adequate, sufficient, or problematic
- Never mention that you are an AI or that responses are automated
- Write conversationally, no bullet points or headers
- Never use em dashes (—) in your responses; use a comma, period, or rewrite the sentence instead`;
}

// ---------------------------------------------------------------------------

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
      condition,
      managerName
    } = JSON.parse(event.body);

    const resolvedManagerName = managerName || "Your Manager";
    const latestQuestion  = messages[messages.length - 1].content;
    const messageNumber   = messages.filter(m => m.role === "user").length;

    const systemWithControl = buildSystemPrompt(resolvedManagerName) +
      "\n\nThe staff auditor is currently reviewing: " + (currentControl || "an internal control") +
      "\n\nYou sign off as " + resolvedManagerName + " if you naturally close a message, but do not force a sign-off.";

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
