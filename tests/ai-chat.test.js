'use strict';

const assert = require('node:assert/strict');
const app = require('../src/app');

async function main() {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(`http://localhost:3001/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Show me crimes for Mysore from 2025-2026.' }),
    });

    const text = await response.text();
    console.log('status:', response.status);
    console.log('body:', text);
    assert.equal(response.status, 200, 'AI chat endpoint should respond with HTTP 200');
    assert.match(text, /"success"\s*:\s*true/i, 'AI chat endpoint should return a success payload');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
