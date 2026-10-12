// netlify/functions/check-attention-2.js
// Evaluates second set of attention check answers and returns pass/fail flags
//
// Query parameters:
//   ac4      — selected choice text for question 4 (role)
//   ac5      — selected choice text for question 5 (purpose of interim procedures)
//   ac6      — selected choice text for question 6 (key risk area)

const headers = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const params = event.queryStringParameters || {};
  const ac4    = String(params.ac4 || "").trim();
  const ac5    = String(params.ac5 || "").trim();
  const ac6    = String(params.ac6 || "").trim();

  // AC4: correct answer is "Staff auditor conducting interim procedures"
  const fail4 = ac4.includes("Staff auditor conducting interim procedures") ? "0" : "1";

  // AC5: correct answer is "To ensure the internal controls portion of the integrated audit goes smoothly"
  const fail5 = ac5.includes("To ensure the internal controls portion of the integrated audit goes smoothly") ? "0" : "1";

  // AC6: correct answer is "Fund mismanagement and documentation gaps"
  const fail6 = ac6.includes("Fund mismanagement and documentation gaps") ? "0" : "1";

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ac_fail_4: fail4,
      ac_fail_5: fail5,
      ac_fail_6: fail6,
      debug_received: { ac4, ac5, ac6 }
    })
  };
};
