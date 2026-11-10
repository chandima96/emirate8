const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

if (!apiKey) {
  console.error('ANTHROPIC_API_KEY is missing from the environment loaded by Next.js.');
  process.exit(1);
}

async function main() {
  const startedAt = Date.now();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 32,
        messages: [{ role: 'user', content: 'Reply with only OK.' }],
      }),
      signal: AbortSignal.timeout(20000),
    });

    const payload = await response.json().catch(() => null);
    const elapsedMs = Date.now() - startedAt;

    if (!response.ok) {
      const message = typeof payload?.error?.message === 'string'
        ? payload.error.message.replaceAll(apiKey, '[redacted]').slice(0, 400)
        : 'No provider error message was returned.';
      console.error(`Anthropic check failed: HTTP ${response.status} in ${elapsedMs} ms.`);
      console.error(`Error type: ${payload?.error?.type || 'unknown'}`);
      console.error(`Message: ${message}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Anthropic API check succeeded: HTTP ${response.status} in ${elapsedMs} ms.`);
    console.log(`Model: ${payload?.model || model}`);
    console.log(`Request ID: ${payload?.request_id || payload?.id || 'not returned'}`);
    console.log(`Usage: ${JSON.stringify(payload?.usage || {})}`);
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const causeCode = error?.cause?.code;
    console.error(`Could not get an Anthropic API response in ${elapsedMs} ms.`);
    console.error(`Network error: ${causeCode || error?.name || 'unknown'}; ${error?.message || 'no details'}`);
    process.exitCode = 1;
  }
}

main();
