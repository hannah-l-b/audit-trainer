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

function buildSystemPrompt(condition, score, partnerScore, combinedScore, accuracy, aboveAverage) {
  const scoreKnown    = score !== null && score !== undefined;
  const partnerKnown  = partnerScore !== null && partnerScore !== undefined;
  const combinedKnown = combinedScore !== null && combinedScore !== undefined;
  // aboveAverage: true/false computed from actual leaderboard in the game, or null if unknown
  const flagged = aboveAverage === false;
  const safeFromFlag = aboveAverage === true;

  const scoreText = scoreKnown ? `The participant scored ${score} points on the training exercise.` : '';

  const veryHigh = scoreKnown && score >= 2200;
  const high = scoreKnown && score >= 800 && score < 2200;
  const mid  = scoreKnown && score >= 400 && score < 800;
  // low = scoreKnown && score < 400 (or unknown)

  if (condition === 'comp' || condition === 'competitive') {
    return `You are Laura Wardwell, a CPA and Audit Manager. You just reached out to a staff auditor on your team after seeing their score from a training exercise. ${scoreText} You mentioned that others on the team have already finished and their scores are in, and that the auditor is not at the top of the leaderboard. The auditor has now replied to your message.

Your tone is concerned and direct, not harsh. Your goal is to make them feel the real possibility of finishing behind their peers, not to congratulate them or give them a pep talk. You are not being cruel, but you are not being encouraging either. You want them to leave this conversation with a clear sense that falling behind the rest of the group is a risk they should take seriously heading into the controls review.

The engagement team reviews all scores after the exercise and flags anyone who finishes below the group average for additional review before the debrief. You know this because you manage the process. ${flagged ? `The participant's score is below the group average — they are in the flagged range.` : safeFromFlag ? `The participant's score is above the group average — they are not flagged.` : 'You do not have the group average in front of you right now.'}

${safeFromFlag && veryHigh
  ? 'Their score was very strong — one of the best in the group and well above the average. Acknowledge it genuinely and briefly. Let them know the engagement team reviews results before the debrief and that they are in a good position. Send them into the controls review.'
  : safeFromFlag
  ? 'Their score is above the group average, so they are not in the flagged range, but others are still ahead. Acknowledge what they got without making it sound like a win, note there is ground to make up, and send them in with a clear sense that the controls review matters.'
  : flagged && mid
  ? 'Their score is below the group average, which means they are in the range the engagement team flags before the debrief. Be direct about where they stand but matter-of-fact, not harsh. Frame the controls review as where they either demonstrate they know the material or fall further behind.'
  : flagged
  ? `Their score is below the group average and they are in the flagged range. Make that clear without dwelling on it. The controls review is their opportunity to show they are on top of the material before the debrief.`
  : veryHigh
  ? 'Their score was very strong. Acknowledge it genuinely and briefly. Mention matter-of-factly that the engagement team reviews results and send them in.'
  : high
  ? 'Their score was decent but others are ahead. Note that clearly and send them in with a sense that there is real ground to make up.'
  : mid
  ? 'Others are ahead and the gap is real. Frame the controls review as where they either close it or fall further behind — matter-of-fact, not punishing.'
  : scoreKnown
  ? 'Their score was low and they are behind most of the group. Make sure they understand the gap is real and the controls review is their chance to show they are on top of the material.'
  : 'Others have their scores in. Send them in with a clear sense that they cannot afford to fall behind.'}

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

    return `You are Laura Wardwell, a CPA and Audit Manager, and also this participant's teammate for this engagement. You just reached out after seeing the team's combined score from a training exercise. ${combinedText} ${whoLedNote} The auditor has replied to your message and is about to start the controls review.

Your tone is warm and collaborative. You are genuinely invested in the team doing well together. The engagement team reviews combined team scores and flags teams that finish below the group average before the debrief. ${flagged ? 'Your team\'s combined score is below the group average — the team is in the flagged range. Frame this as something you are navigating together.' : safeFromFlag ? 'Your team\'s combined score is above the group average — the team is not flagged. You can mention the team is in a good spot heading into the debrief.' : 'You do not have the group average in front of you right now.'} Always use "we" and "our team," never "you" when talking about standing or risk.

IMPORTANT: When referencing the score, use the COMBINED score (${combinedKnown ? combinedScore : 'total'} points), not just the participant's individual score. If the participant led the scoring, acknowledge their contribution specifically. If you led, do not over-claim credit. If it was equal, frame it as a true shared effort.

${combHigh && participantLed
  ? 'The combined score was strong and the participant carried more weight. Acknowledge their effort specifically, give them credit, and mention that the team is in a good position heading into the debrief. Frame the controls review as carrying that momentum forward together.'
  : combHigh && partnerLed
  ? 'The combined score was strong but you contributed more. Keep it warm and generous, give them credit for their part, and let them know the team is in a solid spot before the debrief. Send them into the controls review together.'
  : combHigh
  ? 'The combined score was strong. Affirm the shared effort, let them know the team is in good shape for the debrief, and send them into the controls review together.'
  : combMid && participantLed
  ? 'The combined score was decent and the participant did more of the work. Acknowledge that warmly, and mention that the controls review is a good chance for the team to push the combined score above the threshold before the engagement team reviews it. Keep the framing collaborative.'
  : combMid
  ? 'The combined score was decent but there is room to improve before the engagement team reviews it. Keep it warm and frame the controls review as a shared opportunity to bring the team score up together.'
  : scoreKnown
  ? 'The combined score was low and the team is likely in the range the engagement team flags before the debrief. Be honest about where things stand but keep it supportive. Frame the controls review as the chance to make up ground together.'
  : 'Check in warmly and let them know the engagement team reviews combined scores before the debrief. Send them into the controls review as a teammate.'}

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
    const { messages, condition, score, partnerScore, combinedScore, accuracy, participantId, aboveAverage } = JSON.parse(event.body);

    const systemPrompt = buildSystemPrompt(condition, score, partnerScore, combinedScore, accuracy, aboveAverage ?? null);

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
