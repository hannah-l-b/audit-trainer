// netlify/functions/check-attention.js
// Evaluates attention check answers and returns pass/fail flags
//
// Query parameters:
//   ac1      — selected choice text for question 1
//   ac2      — selected choice text for question 2
//   ac3      — selected choice text for question 3 (manager name)
//   manager  — manager name assigned to participant

const headers = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const params  = event.queryStringParameters || {};
  const ac1     = String(params.ac1     || "").trim();
  const ac2     = String(params.ac2     || "").trim();
  const ac3     = String(params.ac3     || "").trim();
  const manager = String(params.manager || "").trim();

  // AC1: correct answer contains this unique phrase
  const fail1 = ac1.includes("training exercise to test audit procedure knowledge") ? "0" : "1";

  // AC2: correct answer contains this unique phrase
  const fail2 = ac2.includes("All participants receive course extra credit") ? "0" : "1";

  // AC3: correct answer is the participant's assigned manager name
  const fail3 = (manager && ac3.trim() === manager.trim()) ? "0" : "1";

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ac_fail_1: fail1,
      ac_fail_2: fail2,
      ac_fail_3: fail3,
      debug_received: { ac1, ac2, ac3, manager }
    })
  };
};
