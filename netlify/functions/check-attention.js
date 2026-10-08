// netlify/functions/check-attention.js
// Evaluates attention check answers and returns pass/fail flags
//
// Query parameters:
//   ac1      — selected choice ID for question 1 (correct = 2)
//   ac2      — selected choice ID for question 2 (correct = 4)
//   ac3      — selected choice ID for question 3 (correct depends on manager)
//   manager  — manager name assigned to participant

const headers = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

const MANAGER_CORRECT = {
  "Laura Wardwell": "1",
  "Yeyang Zhou":    "2",
  "Jinhua Sun":     "3",
  "Brent Myers":    "4",
  "Andrew Zilles":  "5"
};

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const params = event.queryStringParameters || {};
  const ac1     = String(params.ac1     || "");
  const ac2     = String(params.ac2     || "");
  const ac3     = String(params.ac3     || "");
  const manager = params.manager        || "";

  const correctAc3 = MANAGER_CORRECT[manager] || null;

  const fail1 = ac1 !== "2"          ? "1" : "0";
  const fail2 = ac2 !== "4"          ? "1" : "0";
  const fail3 = (!correctAc3 || ac3 !== correctAc3) ? "1" : "0";

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ ac_fail_1: fail1, ac_fail_2: fail2, ac_fail_3: fail3 })
  };
};
