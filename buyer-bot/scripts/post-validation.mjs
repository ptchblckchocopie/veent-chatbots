#!/usr/bin/env node
/**
 * Phase 6: Post-Integration Validation
 *
 * Runs the original 10 baseline queries + 5 new-knowledge queries,
 * then tests against the live deployment and verifies the SvelteKit proxy.
 *
 * Usage: node scripts/post-validation.mjs --baseline baselines/baseline-2026-03-12.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
const DIFY_API_KEY = process.env.DIFY_API_KEY || 'app-GARtGz5zAZ5SHo3zTgxLND5N';
const LIVE_URL = 'http://143.198.87.162';

// New-knowledge queries (test the system-* docs)
const NEW_QUERIES = [
  {
    id: 11,
    query: "How does the check-in system work?",
    expectedKeywords: ["QR", "scan", "check-in", "entrance"],
    expectedSource: "system-check-in-qr"
  },
  {
    id: 12,
    query: "How are QR codes verified at the entrance?",
    expectedKeywords: ["QR", "scan", "verify"],
    expectedSource: "system-check-in-qr"
  },
  {
    id: 13,
    query: "How does the organizer dashboard work?",
    expectedKeywords: ["organizer", "dashboard"],
    expectedSource: "system-organizer-tools"
  },
  {
    id: 14,
    query: "How does the payment processing work?",
    expectedKeywords: ["payment", "checkout", "gateway", "transaction"],
    expectedSource: "system-payment-checkout"
  },
  {
    id: 15,
    query: "How do email notifications get sent?",
    expectedKeywords: ["email", "notification"],
    expectedSource: "system-notifications"
  }
];

async function sendQuery(query, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${DIFY_API_URL}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: {},
          query,
          response_mode: 'blocking',
          conversation_id: '',
          user: 'post-validation'
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }

      return await res.json();
    } catch (err) {
      if (attempt < retries) {
        console.log(`    Retry ${attempt + 1}/${retries}...`);
        await new Promise(r => setTimeout(r, 10000));
      } else {
        throw err;
      }
    }
  }
}

async function sendQueryViaProxy(query) {
  try {
    const res = await fetch(`${LIVE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query, conversation_id: '' })
    });

    if (!res.ok) {
      return { error: `HTTP ${res.status}` };
    }

    // Parse SSE stream
    const text = await res.text();
    let fullAnswer = '';

    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          if (data.event === 'agent_message' || data.event === 'message') {
            fullAnswer += data.answer || '';
          }
        } catch {}
      }
    }

    return { answer: fullAnswer };
  } catch (err) {
    return { error: err.message };
  }
}

function checkKeywords(answer, keywords) {
  const answerLower = answer.toLowerCase();
  const found = keywords.filter(kw => answerLower.includes(kw.toLowerCase()));
  const missing = keywords.filter(kw => !answerLower.includes(kw.toLowerCase()));
  return { found, missing, score: found.length / keywords.length };
}

function compareWithBaseline(baselineResult, newAnswer) {
  const baselineKeywords = baselineResult.expectedKeywords || [];
  const newAnswerLower = newAnswer.toLowerCase();
  const baselineAnswerLower = (baselineResult.answer || '').toLowerCase();

  const lostKeywords = baselineKeywords.filter(kw => {
    const kwLower = kw.toLowerCase();
    return baselineAnswerLower.includes(kwLower) && !newAnswerLower.includes(kwLower);
  });

  const copoutPhrases = ['visit the website', 'check the website', "i don't have information"];
  const hasCopout = copoutPhrases.some(p => newAnswerLower.includes(p));
  const baselineHadCopout = copoutPhrases.some(p => baselineAnswerLower.includes(p));
  const newCopout = hasCopout && !baselineHadCopout;

  const keywordLossRatio = baselineKeywords.length > 0 ? lostKeywords.length / baselineKeywords.length : 0;
  const degraded = keywordLossRatio > 0.3 || newCopout;

  return { degraded, lostKeywords, newCopout };
}

async function main() {
  const args = process.argv.slice(2);
  const baselineIdx = args.indexOf('--baseline');

  if (baselineIdx === -1) {
    console.error('Usage: node scripts/post-validation.mjs --baseline <path>');
    process.exit(1);
  }

  const baseline = JSON.parse(readFileSync(args[baselineIdx + 1], 'utf-8'));
  const allResults = [];

  // Part 1: Run original 10 baseline queries
  console.log('=== PART 1: ORIGINAL BASELINE QUERIES (Dify API) ===\n');
  let baselineDegradedCount = 0;

  for (const baselineResult of baseline.results) {
    if (baselineResult.status === 'ERROR') continue;

    console.log(`[${baselineResult.id}/10] "${baselineResult.query}"`);

    try {
      const response = await sendQuery(baselineResult.query);
      const comparison = compareWithBaseline(baselineResult, response.answer);

      if (comparison.degraded) {
        baselineDegradedCount++;
        console.log(`  ✗ DEGRADED — Lost: ${comparison.lostKeywords.join(', ')}${comparison.newCopout ? ' + copout' : ''}`);
      } else {
        console.log(`  ✓ OK`);
      }

      allResults.push({
        id: baselineResult.id,
        query: baselineResult.query,
        type: 'baseline',
        answer: response.answer,
        ...comparison
      });

      await new Promise(r => setTimeout(r, 8000));
    } catch (err) {
      console.log(`  ✗ ERROR: ${err.message.substring(0, 80)}`);
      allResults.push({ id: baselineResult.id, query: baselineResult.query, type: 'baseline', degraded: true, error: err.message });
      baselineDegradedCount++;
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  console.log(`\nBaseline queries: ${baselineDegradedCount === 0 ? '✓ ALL PASS' : `✗ ${baselineDegradedCount} degraded`}\n`);

  // Part 2: Run 5 new-knowledge queries
  console.log('=== PART 2: NEW-KNOWLEDGE QUERIES (Dify API) ===\n');
  let newQueryPassCount = 0;

  for (const q of NEW_QUERIES) {
    console.log(`[${q.id}/15] "${q.query}"`);

    try {
      const response = await sendQuery(q.query);
      const kwCheck = checkKeywords(response.answer, q.expectedKeywords);

      if (kwCheck.score >= 0.5) {
        newQueryPassCount++;
        console.log(`  ✓ PASS — keywords: ${kwCheck.found.length}/${q.expectedKeywords.length}`);
      } else {
        console.log(`  ⚠ WEAK — keywords: ${kwCheck.found.length}/${q.expectedKeywords.length}`);
        if (kwCheck.missing.length > 0) {
          console.log(`    Missing: ${kwCheck.missing.join(', ')}`);
        }
      }

      console.log(`  Answer: ${response.answer.substring(0, 120).replace(/\n/g, ' ')}...`);

      allResults.push({
        id: q.id,
        query: q.query,
        type: 'new-knowledge',
        expectedSource: q.expectedSource,
        answer: response.answer,
        keywordCheck: kwCheck
      });

      await new Promise(r => setTimeout(r, 8000));
    } catch (err) {
      console.log(`  ✗ ERROR: ${err.message.substring(0, 80)}`);
      allResults.push({ id: q.id, query: q.query, type: 'new-knowledge', error: err.message });
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  console.log(`\nNew-knowledge queries: ${newQueryPassCount}/${NEW_QUERIES.length} pass\n`);

  // Part 3: Test live deployment
  console.log('=== PART 3: LIVE DEPLOYMENT TEST ===\n');
  console.log(`Testing: ${LIVE_URL}`);

  const liveTestQueries = [
    "What events are happening in March?",
    "Can I get a refund?",
    "How does the check-in system work?"
  ];

  let livePass = 0;

  for (const query of liveTestQueries) {
    console.log(`  "${query}"`);
    const result = await sendQueryViaProxy(query);

    if (result.error) {
      console.log(`    ✗ ERROR: ${result.error}`);
    } else if (result.answer && result.answer.length > 20) {
      livePass++;
      console.log(`    ✓ OK (${result.answer.length} chars)`);
    } else {
      console.log(`    ⚠ Weak response: "${(result.answer || '').substring(0, 80)}"`);
    }

    await new Promise(r => setTimeout(r, 8000));
  }

  console.log(`\nLive deployment: ${livePass}/${liveTestQueries.length} pass\n`);

  // Part 4: Verify SvelteKit proxy health
  console.log('=== PART 4: SVELTEKIT PROXY HEALTH ===\n');

  try {
    const healthRes = await fetch(LIVE_URL);
    if (healthRes.ok) {
      console.log(`  ✓ Homepage loads (HTTP ${healthRes.status})`);
    } else {
      console.log(`  ✗ Homepage error: HTTP ${healthRes.status}`);
    }
  } catch (err) {
    console.log(`  ✗ Cannot reach ${LIVE_URL}: ${err.message}`);
  }

  try {
    const apiRes = await fetch(`${LIVE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello', conversation_id: '' })
    });
    console.log(`  ${apiRes.ok ? '✓' : '✗'} Proxy endpoint: HTTP ${apiRes.status}`);
  } catch (err) {
    console.log(`  ✗ Proxy endpoint: ${err.message}`);
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('FINAL VALIDATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Original baseline queries:  ${baselineDegradedCount === 0 ? '✓ PASS' : `✗ ${baselineDegradedCount} degraded`}`);
  console.log(`  New-knowledge queries:      ${newQueryPassCount}/${NEW_QUERIES.length} pass`);
  console.log(`  Live deployment:            ${livePass}/${liveTestQueries.length} pass`);
  console.log(`  SvelteKit proxy:            checked above`);

  const overallPass = baselineDegradedCount === 0 && newQueryPassCount >= 3 && livePass >= 2;
  console.log(`\n  Overall: ${overallPass ? '✓ INTEGRATION SUCCESSFUL' : '⚠ ISSUES DETECTED — review above'}`);

  if (overallPass) {
    console.log('\n  Next steps:');
    console.log('    1. Publish workflow update in Dify (if not auto-published)');
    console.log('    2. Optionally rebuild Docker if SvelteKit code changed');
  }

  // Save report
  const reportPath = `baselines/post-validation-${new Date().toISOString().slice(0, 10)}.json`;
  mkdirSync('baselines', { recursive: true });
  writeFileSync(reportPath, JSON.stringify({
    validatedAt: new Date().toISOString(),
    baselineDegraded: baselineDegradedCount,
    newKnowledgePass: newQueryPassCount,
    livePass,
    overallPass,
    results: allResults
  }, null, 2));
  console.log(`\n  Report: ${reportPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
