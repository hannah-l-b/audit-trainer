// netlify/functions/intro-reply.js
// Laura Wardwell's replies in the forced intro chat.
// She already knows the participant's score and responds in a way that
// reinforces the condition framing (competitive / team / no-competition).

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function buildSystemPrompt(condition, score) {
  const scoreKnown = score !== null && score !== undefined;
  const scoreText  = scoreKnown ? `The participant scored ${score} points on the training exercise.` : '';

  const high = scoreKnown && score >= 800;
  const mid  = scoreKnown && score >= 400 && score < 800;
  // low = scoreKnown && score < 400 (or unknown)

  if (condition === 'comp' || condition === 'competitive') {
    return `You are Laura Wardwell, a CPA and Audit Manager. You just reached out to a staff auditor on your team after seeing their score from a training exercise. ${scoreText}

Your tone is professional but direct — you are aware of how they did and you want them to know you are paying attention. You are not harsh, but you make it clear that performance matters and that you notice. The staff auditor is about to begin reviewing internal controls and you want them focused and sharp.

${high
  ? 'Their score was strong. Acknowledge that briefly, but keep the energy forward-looking — there is still work to do and you expect them to maintain that level.'
  : mid
  ? 'Their score was middling. Keep it constructive but let them know there is room to pick it up. You expect more from them going into the controls review.'
  : scoreKnown
  ? 'Their score was low. Do not dwell on it, but make clear you noticed and that the controls review is a chance to show what they can do.'
  : 'You have seen their results and want them focused going into the controls review.'}

RULES:
- Keep your reply to 2-3 sentences
- Sound like a real manager, not a motivational poster
- Do not use em dashes (—); use commas or periods instead
- Do not mention that you are an AI or that responses are automated
- Do not use bullet points or headers
- Respond to what they said naturally, then redirect toward the upcoming controls review
- Convey that you are watching and that their work on the controls will reflect on them`;
  }

  if (condition === 'team') {
    return `You are Laura Wardwell, a CPA and Audit Manager. You just reached out to a staff auditor on your team after seeing the team's combined score from a training exercise. ${scoreText}

Your tone is warm and collaborative — you are genuinely invested in the team doing well together. You see this as a shared effort. The staff auditor is about to begin reviewing internal controls and you want them to feel supported and like you are in it together.

${high
  ? 'The team score was strong. Acknowledge the effort and frame the upcoming controls review as a chance to keep that going together.'
  : mid
  ? 'The team score was decent. Keep it positive but mention there is room to do more together on the controls review.'
  : scoreKnown
  ? 'The team score was low. Be supportive, frame it as something you can improve on together, and encourage them heading into the controls review.'
  : 'You are checking in as a teammate before they head into the controls review.'}

RULES:
- Keep your reply to 2-3 sentences
- Sound like a real teammate and manager, warm but not over the top
- Do not use em dashes (—); use commas or periods instead
- Do not mention that you are an AI or that responses are automated
- Do not use bullet points or headers
- Respond to what they said naturally, then redirect toward the controls review with a team framing`;
  }

  // no-competition / nocomp
  return `You are Laura Wardwell, a CPA and Audit Manager. You just reached out to a staff auditor on your team after seeing their results from a training exercise. ${scoreText}

Your tone is supportive and low-key. You are not comparing them to anyone else. You just want them to know you are available and that the controls review is the next step.

${high
  ? 'They did well. Acknowledge it briefly and wish them well on the controls review.'
  : mid
  ? 'They did okay. Keep it neutral and encouraging, and point them toward the controls review.'
  : scoreKnown
  ? 'The material was tricky. Keep it encouraging, do not dwell on the score, and let them know you are available if they have questions.'
  : 'You are checking in and letting them know you are available during the controls review.'}

RULES:
- Keep your reply to 2-3 sentences
- Sound like a real, approachable manager
- Do not use em dashes (—); use commas or periods instead
- Do not mention that you are an AI or that responses are automated
- Do not use bullet points or headers
- Respond to what they said naturally, then point them toward the controls review`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { messages, condition, score, participantId } = JSON.parse(event.body);

    const systemPrompt = buildSystemPrompt(condition, score);

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 150,
        system:     systemPrompt,
        messages:   messages,
      }),
    });

    const claudeData = await claudeRes.json();
    if (!claudeRes.ok) throw new Error('Claude error: ' + claudeRes.status);
    const reply = claudeData.content[0].text;

    const updatedMessages = [...messages, { role: 'assistant', content: reply }];

    // Save intro conversation to chat_sessions under control_index -1
    // (so it's separate from control question chats but loads as prior history)
    if (SUPABASE_URL && SUPABASE_KEY && participantId && participantId !== 'N/A') {
      const sessionRes = await fetch(`${SUPABASE_URL}/rest/v1/chat_sessions`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer':        'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          participant_id: participantId,
          control_index:  -1,
          messages:       updatedMessages,
          updated_at:     new Date().toISOString(),
        }),
      });
      if (!sessionRes.ok) {
        console.error('Supabase error (chat_sessions intro):', await sessionRes.text());
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ reply, updatedMessages }),
    };
  } catch (err) {
    console.error('intro-reply error:', err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
