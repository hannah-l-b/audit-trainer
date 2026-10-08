// netlify/functions/get-manager.js
// Returns a manager number (1-5) based on the current second
// Called by Qualtrics Web Service in the survey flow

const headers = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const sec = new Date().getSeconds();

  let manager;
  if (sec <= 11) {
    manager = 1;
  } else if (sec <= 23) {
    manager = 2;
  } else if (sec <= 35) {
    manager = 3;
  } else if (sec <= 47) {
    manager = 4;
  } else {
    manager = 5;
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ manager })
  };
};
