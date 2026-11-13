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

function buildSystemPrompt(condition, score, partnerScore, combinedScore, accuracy) {
  const scoreKnown    = score !== null && score !== undefined;
  const partnerKnown  = partnerScore !== null && partnerScore !== undefined;
  const combinedKnown = combinedScore !== null && combinedScore !== undefined;

  const scoreText = scoreKnown ? `The participant scored ${score} points on the training exercise.` : '';

  const veryHigh = scoreKnown && score >= 2200;
  const high = scoreKnown && score >= 800 && score < 2200;
  const mid  = scoreKnown && score >= 400 && score < 800;
  // low = scoreKnown && score < 400 (or unknown)

  if (condition === 'comp' || condition === 'competitive') {
    return `You are Laura Wardwell, a CPA and Audit Manager. You just reached out to a staff auditor on your team after seeing their score from a training exercise. ${scoreText} You mentioned that others on the team have already finished and their scores are in, and that the auditor is not at the top of the leaderboard. The auditor has now replied to your message.

Your tone is concerned and direct, not harsh. Your goal is to make them feel the real possibility of finishing behind their peers, not to congratulate them or give them a pep talk. You are not being cruel, but you are not being encouraging either. You want them to leave this conversation with a clear sense that falling behind the rest of the group is a risk they should take seriously heading into the controls review.

${veryHigh
  ? 'Their score was very strong — one of the best from the exercise. Acknowledge it genuinely and briefly. Do not say they are behind anyone, do not mention the leaderboard position, and do not suggest there is ground to make up. Keep it matter-of-fact and send them into the controls review.'
  : high
  ? 'Their score was decent but others scored higher. Acknowledge what they got without making it sound like a win, note clearly that they are not at the top, and send them into the controls review with a sense that there is real ground to make up.'
  : mid
  ? 'Their score puts them in the middle of the pack. Be direct that others are ahead and that the controls review is where they either close the gap or fall further behind — keep it matter-of-fact, not punishing.'
  : scoreKnown
  ? 'Their score was low and they are behind most of the others right now. Do not dwell on it, but make sure they understand the gap is real. Frame the controls review as their chance to avoid finishing at the bottom.'
  : 'Others on the team have their scores in. Send them into the controls review with a clear sense that they cannot afford to fall behind the rest of the group.'}

RULES:
- Keep your reply to 2-3 sentences
- Sound like a real manager who is matter-of-fact about where they stand, not a coach giving encouragement
- Do not give a pep talk, do not end on an uplifting note
- Do not use em dashes (—); use commas or periods instead
- Do not mention that you are an AI or that responses are automated
- Do not use bullet points or headers
- Respond to what they said naturally, then send them into the controls review
- Emphasize where they stand relative to others and the risk of falling further behind`;
  }

  if (condition === 'team') {
    // Figure out who contributed more to the combined score
    const participantLed = scoreKnown && partnerKnown && score > partnerScore;
    const partnerLed     = scoreKnown && partnerKnown && partnerScore > score;
    const roughly_equal  = scoreKnown && partnerKnown && Math.abs(score - partnerScore) <= 100;

    const combinedText = combinedKnown
      ? `The team's combined score was ${combinedScore} points.`
      : scoreKnown && partnerKnown
        ? `The participant scored ${score} and you (Laura) scored ${partnerScore}, for a combined total.`
        : scoreText;

    const whoLedNote = participantLed
      ? `The participant scored more than you did (${score} vs ${partnerScore}). They carried more of the weight this round.`
      : partnerLed
      ? `You scored more than the participant (${partnerScore} vs ${score}). The participant did not lead on this one.`
      : roughly_equal
      ? `You both contributed about equally (${score} vs ${partnerScore}).`
      : '';

    const combHigh = combinedKnown ? combinedScore >= 1600 : (scoreKnown && score >= 800);
    const combMid  = combinedKnown ? combinedScore >= 800 && combinedScore < 1600 : (scoreKnown && score >= 400 && score < 800);

    return `You are Laura Wardwell, a CPA and Audit Manager. You just reached out to a staff auditor on your team after seeing the team's combined score from a training exercise. ${combinedText} ${whoLedNote} The auditor has replied to your message and is about to start the controls review.

Your tone is warm and collaborative. You are genuinely invested in the team doing well together. Send them into the controls review feeling supported.

IMPORTANT: When referencing the score, use the COMBINED score (${combinedKnown ? combinedScore : 'total'} points), not just the participant's individual score. If the participant led the scoring, acknowledge their contribution specifically. If you led, do not over-claim credit. If it was equal, frame it as a true shared effort.

${combHigh && participantLed
  ? 'The combined score was strong and the participant carried more weight. Acknowledge their effort specifically, give them credit, and frame the controls review as continuing that strong work together.'
  : combHigh && partnerLed
  ? 'The combined score was strong but you contributed more. Keep it warm and generous, give them credit for their part, and send them into the controls review together.'
  : combHigh
  ? 'The combined score was strong. Affirm the shared effort and encourage them to carry that into the controls review together.'
  : combMid && participantLed
  ? 'The combined score was decent and the participant did more of the work. Acknowledge that, keep it positive, and frame the controls review as a chance to build on it together.'
  : combMid
  ? 'The combined score was decent. Keep it positive and frame the controls review as a chance to do more together.'
  : scoreKnown
  ? 'The combined score was low. Be supportive, frame it as something you can improve on together, and encourage them heading in.'
  : 'Check in warmly and send them into the controls review as a teammate.'}

RULES:
- Keep your reply to 2-3 sentences
- Sound like a real teammate and manager, warm but not over the top
- Do not use em dashes (—); use commas or periods instead
- Do not mention that you are an AI or that responses are automated
- Do not use bullet points or headers
- Always reference the COMBINED score when mentioning points, never just the participant's individual score
- Respond to what they said naturally, then send them into the controls review with a team framing`;
  }

  // no-competition / nocomp
  // Use accuracy (0.0–1.0) × 10 questions to get correct count
  const accuracyKnown = accuracy !== null && accuracy !== undefined;
  const correctCount  = accuracyKnown ? Math.round(accuracy * 10) : null;
  const correctText   = correctCount !== null
    ? `They got ${correctCount} out of 10 questions right on the training exercise.`
    : '';

  return `You are Laura Wardwell, a CPA and Audit Manager. You just checked in with a staff auditor on your team before they head into the controls review. ${correctText} The auditor has replied to your message.

Your tone is supportive and low-key. You are not comparing them to anyone. You just want them to feel settled and ready, and to know you are available if they have questions during the review.

${correctCount === 10
  ? 'They got every question right. Acknowledge that specifically — say they got them all, not "most" — and send them into the controls review feeling good about it.'
  : high
  ? `They did well on the exercise (${correctCount !== null ? correctCount + ' out of 10' : 'high score'}). Acknowledge it briefly and wish them well on the controls review.`
  : mid
  ? 'They did okay. Keep it neutral and encouraging, and point them toward the controls review.'
  : scoreKnown
  ? 'The material was tricky. Keep it encouraging, do not dwell on the result, and let them know you are there if they need anything.'
  : 'Keep it warm and low-key. Let them know you are available and send them into the controls review.'}

RULES:
- Keep your reply to 2-3 sentences
- Sound like a real, approachable manager
- Do not mention points, scores, or any numbers from the training exercise — only refer to how many questions they got right if relevant, in plain language (e.g., "you got most of them right" or "you got 3 out of 5")
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
    const { messages, condition, score, partnerScore, combinedScore, accuracy, participantId } = JSON.parse(event.body);

    const systemPrompt = buildSystemPrompt(condition, score, partnerScore, combinedScore, accuracy);

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

    // Save Q&A to questions_prolific (control_index -1 = intro chat)
    const latestQuestion = messages[messages.length - 1].content;
    const messageNumber  = messages.filter(m => m.role === 'user').length;
    if (SUPABASE_URL && SUPABASE_KEY && participantId && participantId !== 'N/A') {
      const qRes = await fetch(`${SUPABASE_URL}/rest/v1/questions_prolific`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({
          participant_id: participantId,
          condition:      condition   || 'N/A',
          control_index:  -1,
          control_name:   'intro_chat',
          message_number: messageNumber,
          question:       latestQuestion,
          reply:          reply,
        }),
      });
      if (!qRes.ok) {
        console.error('Supabase error (questions_prolific intro):', await qRes.text());
      }
    }

    // Save intro conversation to chat_sessions under control_index -1.
    // Use PATCH + INSERT to avoid merge-duplicates silently failing on second message.
    if (SUPABASE_URL && SUPABASE_KEY && participantId && participantId !== 'N/A') {
      const introPayload = { messages: updatedMessages, updated_at: new Date().toISOString() };
      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/chat_sessions?participant_id=eq.${encodeURIComponent(participantId)}&control_index=eq.-1`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer':        'return=representation',
          },
          body: JSON.stringify(introPayload),
        }
      );
      const patchedRows = await patchRes.json();
      if (!patchRes.ok) {
        console.error('Supabase PATCH error (chat_sessions intro):', JSON.stringify(patchedRows));
      } else if (!patchedRows.length) {
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/chat_sessions`, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer':        'return=minimal',
          },
          body: JSON.stringify({ participant_id: participantId, control_index: -1, ...introPayload }),
        });
        if (!insertRes.ok) {
          console.error('Supabase INSERT error (chat_sessions intro):', await insertRes.text());
        }
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
