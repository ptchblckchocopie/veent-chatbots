#!/usr/bin/env node
/**
 * Phase 1: Baseline Capture Script
 *
 * Sends 10 test queries to the Dify API (blocking mode) and saves
 * the responses as a JSON baseline file for comparison after uploads.
 *
 * Usage: node scripts/baseline-capture.mjs [--output baselines/baseline-YYYY-MM-DD.json]
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// --- Configuration ---
const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
const DIFY_API_KEY = process.env.DIFY_API_KEY || 'app-GARtGz5zAZ5SHo3zTgxLND5N';

const BASELINE_QUERIES = [
  {
    id: 1,
    query: "What events are happening in March?",
    expectedSource: "events-march-2026-v2",
    expectedKeywords: ["SUB1-SAHARUN", "Miles For Smiles", "Run4UrHeart", "RUN FOR ILOILO RIVER"]
  },
  {
    id: 2,
    query: "How much are tickets for Lani Misalucha?",
    expectedSource: "events-april-2026-v2",
    expectedKeywords: ["5,500", "4,400", "3,300", "2,200", "800", "600"]
  },
  {
    id: 3,
    query: "Can I get a refund?",
    expectedSource: "faq-and-policies",
    expectedKeywords: ["no refund", "final", "cancelled"]
  },
  {
    id: 4,
    query: "How do I buy tickets?",
    expectedSource: "website-navigation-guide-v2",
    expectedKeywords: ["select", "seat", "payment", "QR"]
  },
  {
    id: 5,
    query: "What payment methods are accepted?",
    expectedSource: "website-navigation-guide-v2 or about-veent-tix",
    expectedKeywords: ["GCash", "Maya", "Visa", "Mastercard"]
  },
  {
    id: 6,
    query: "How do I contact Veent?",
    expectedSource: "about-veent-tix",
    expectedKeywords: ["support@veenttix.com", "hello@veent.io"]
  },
  {
    id: 7,
    query: "What is Veent Tix?",
    expectedSource: "about-veent-tix",
    expectedKeywords: ["ticketing", "platform", "concerts"]
  },
  {
    id: 8,
    query: "Are there fun runs in April?",
    expectedSource: "events-april-2026-v2",
    expectedKeywords: ["Dash And Splash", "Alfonso Ridge", "Kaldereta Trail Run"]
  },
  {
    id: 9,
    query: "How do I create an account?",
    expectedSource: "website-navigation-guide-v2",
    expectedKeywords: ["LOGIN", "sign-in", "Google"]
  },
  {
    id: 10,
    query: "What events are in CDO?",
    expectedSource: "events (multiple months)",
    expectedKeywords: ["Lani Misalucha", "CDO", "Cagayan de Oro"]
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
          query: query,
          response_mode: 'blocking',
          conversation_id: '',
          user: 'baseline-test'
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return {
        answer: data.answer || '',
        conversation_id: data.conversation_id || '',
        message_id: data.message_id || '',
        metadata: data.metadata || {}
      };
    } catch (err) {
      if (attempt < retries) {
        console.log(`  Retry ${attempt + 1}/${retries} after error: ${err.message.substring(0, 80)}...`);
        await new Promise(r => setTimeout(r, 10000));
      } else {
        throw err;
      }
    }
  }
}

function checkKeywords(answer, expectedKeywords) {
  const answerLower = answer.toLowerCase();
  const found = [];
  const missing = [];
  for (const kw of expectedKeywords) {
    if (answerLower.includes(kw.toLowerCase())) {
      found.push(kw);
    } else {
      missing.push(kw);
    }
  }
  return { found, missing, score: found.length / expectedKeywords.length };
}

async function main() {
  // Parse output path from args
  const args = process.argv.slice(2);
  let outputIdx = args.indexOf('--output');
  const now = new Date().toISOString().slice(0, 10);
  let outputPath = outputIdx !== -1 ? args[outputIdx + 1] : `baselines/baseline-${now}.json`;

  console.log('=== DIFY BASELINE CAPTURE ===');
  console.log(`API: ${DIFY_API_URL}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Queries: ${BASELINE_QUERIES.length}`);
  console.log('');

  const results = [];
  let passCount = 0;

  for (const q of BASELINE_QUERIES) {
    console.log(`[${q.id}/10] "${q.query}"`);
    const startTime = Date.now();

    try {
      const response = await sendQuery(q.query);
      const elapsed = Date.now() - startTime;
      const kwCheck = checkKeywords(response.answer, q.expectedKeywords);

      const result = {
        id: q.id,
        query: q.query,
        expectedSource: q.expectedSource,
        expectedKeywords: q.expectedKeywords,
        answer: response.answer,
        conversationId: response.conversation_id,
        messageId: response.message_id,
        metadata: response.metadata,
        latencyMs: elapsed,
        keywordCheck: kwCheck,
        status: kwCheck.score >= 0.5 ? 'PASS' : 'WARN'
      };

      results.push(result);

      if (result.status === 'PASS') passCount++;

      const statusIcon = result.status === 'PASS' ? '✓' : '⚠';
      console.log(`  ${statusIcon} ${result.status} (${elapsed}ms) — keywords: ${kwCheck.found.length}/${q.expectedKeywords.length}`);
      if (kwCheck.missing.length > 0) {
        console.log(`    Missing: ${kwCheck.missing.join(', ')}`);
      }
      // Show first 150 chars of answer
      console.log(`    Answer: ${response.answer.substring(0, 150).replace(/\n/g, ' ')}...`);
      console.log('');

      // Delay between queries to avoid Groq rate limiting (6K TPM free tier)
      await new Promise(r => setTimeout(r, 8000));

    } catch (err) {
      console.log(`  ✗ ERROR: ${err.message}`);
      results.push({
        id: q.id,
        query: q.query,
        expectedSource: q.expectedSource,
        answer: null,
        error: err.message,
        status: 'ERROR'
      });
      console.log('');
    }
  }

  // Summary
  console.log('=== SUMMARY ===');
  console.log(`Pass: ${passCount}/10 | Warn: ${results.filter(r => r.status === 'WARN').length}/10 | Error: ${results.filter(r => r.status === 'ERROR').length}/10`);
  const avgLatency = results.filter(r => r.latencyMs).reduce((sum, r) => sum + r.latencyMs, 0) / results.filter(r => r.latencyMs).length;
  console.log(`Avg latency: ${Math.round(avgLatency)}ms`);

  // Save baseline
  const baseline = {
    capturedAt: new Date().toISOString(),
    apiUrl: DIFY_API_URL,
    queryCount: BASELINE_QUERIES.length,
    passCount,
    avgLatencyMs: Math.round(avgLatency),
    results
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(baseline, null, 2));
  console.log(`\nBaseline saved to: ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
