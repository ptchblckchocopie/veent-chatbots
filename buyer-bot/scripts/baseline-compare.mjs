#!/usr/bin/env node
/**
 * Baseline Comparison Script
 *
 * Runs the same 10 queries and compares against a saved baseline.
 * Flags any degradation in answer quality.
 *
 * Usage: node scripts/baseline-compare.mjs --baseline baselines/baseline-2026-03-12.json [--label "after system-check-in-qr upload"]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
const DIFY_API_KEY = process.env.DIFY_API_KEY || 'app-GARtGz5zAZ5SHo3zTgxLND5N';

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
          user: 'baseline-compare'
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return { answer: data.answer || '', metadata: data.metadata || {} };
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Compare two answers for degradation.
 * Returns { degraded: boolean, reasons: string[] }
 */
function compareAnswers(baselineResult, newAnswer) {
  const reasons = [];

  if (!newAnswer || newAnswer.trim().length === 0) {
    return { degraded: true, reasons: ['Empty answer'] };
  }

  // Check if expected keywords from baseline are still present
  const baselineKeywords = baselineResult.expectedKeywords || [];
  const newAnswerLower = newAnswer.toLowerCase();
  const baselineAnswerLower = (baselineResult.answer || '').toLowerCase();

  // Keywords that were found in baseline but missing in new answer
  const lostKeywords = [];
  for (const kw of baselineKeywords) {
    const kwLower = kw.toLowerCase();
    const wasInBaseline = baselineAnswerLower.includes(kwLower);
    const isInNew = newAnswerLower.includes(kwLower);
    if (wasInBaseline && !isInNew) {
      lostKeywords.push(kw);
    }
  }

  if (lostKeywords.length > 0) {
    reasons.push(`Lost keywords: ${lostKeywords.join(', ')}`);
  }

  // Check if answer became significantly shorter (>50% reduction)
  const baselineLen = (baselineResult.answer || '').length;
  const newLen = newAnswer.length;
  if (baselineLen > 0 && newLen < baselineLen * 0.5) {
    reasons.push(`Answer shortened from ${baselineLen} to ${newLen} chars (${Math.round(newLen / baselineLen * 100)}%)`);
  }

  // Check for generic "visit website" copout answers
  const copoutPhrases = [
    'visit the website',
    'check the website',
    'i don\'t have information',
    'i\'m not sure',
    'i cannot find'
  ];
  const hasCopout = copoutPhrases.some(p => newAnswerLower.includes(p));
  const baselineHadCopout = copoutPhrases.some(p => baselineAnswerLower.includes(p));
  if (hasCopout && !baselineHadCopout) {
    reasons.push('New answer contains generic copout phrase not in baseline');
  }

  // Degraded if we lost >30% of keywords OR answer became a copout
  const keywordLossRatio = baselineKeywords.length > 0 ? lostKeywords.length / baselineKeywords.length : 0;
  const degraded = keywordLossRatio > 0.3 || (hasCopout && !baselineHadCopout) || reasons.length >= 2;

  return { degraded, reasons, lostKeywords, keywordLossRatio };
}

async function main() {
  const args = process.argv.slice(2);
  const baselineIdx = args.indexOf('--baseline');
  const labelIdx = args.indexOf('--label');

  if (baselineIdx === -1 || !args[baselineIdx + 1]) {
    console.error('Usage: node scripts/baseline-compare.mjs --baseline <path> [--label <description>]');
    process.exit(1);
  }

  const baselinePath = args[baselineIdx + 1];
  const label = labelIdx !== -1 ? args[labelIdx + 1] : 'unnamed comparison';

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));

  console.log(`=== BASELINE COMPARISON: ${label} ===`);
  console.log(`Baseline from: ${baseline.capturedAt}`);
  console.log(`Comparing ${baseline.results.length} queries`);
  console.log('');

  const comparisons = [];
  let degradedCount = 0;

  for (const baselineResult of baseline.results) {
    if (baselineResult.status === 'ERROR') {
      console.log(`[${baselineResult.id}/10] SKIP (baseline was ERROR)`);
      continue;
    }

    console.log(`[${baselineResult.id}/10] "${baselineResult.query}"`);
    const startTime = Date.now();

    try {
      const response = await sendQuery(baselineResult.query);
      const elapsed = Date.now() - startTime;
      const comparison = compareAnswers(baselineResult, response.answer);

      const result = {
        id: baselineResult.id,
        query: baselineResult.query,
        baselineAnswer: baselineResult.answer,
        newAnswer: response.answer,
        baselineLatencyMs: baselineResult.latencyMs,
        newLatencyMs: elapsed,
        ...comparison
      };

      comparisons.push(result);

      if (comparison.degraded) {
        degradedCount++;
        console.log(`  ✗ DEGRADED (${elapsed}ms)`);
        for (const reason of comparison.reasons) {
          console.log(`    → ${reason}`);
        }
      } else if (comparison.reasons.length > 0) {
        console.log(`  ⚠ CHANGED (${elapsed}ms)`);
        for (const reason of comparison.reasons) {
          console.log(`    → ${reason}`);
        }
      } else {
        console.log(`  ✓ OK (${elapsed}ms)`);
      }

      // Show answer diff preview
      const baseSnip = (baselineResult.answer || '').substring(0, 100).replace(/\n/g, ' ');
      const newSnip = response.answer.substring(0, 100).replace(/\n/g, ' ');
      if (baseSnip !== newSnip) {
        console.log(`    OLD: ${baseSnip}...`);
        console.log(`    NEW: ${newSnip}...`);
      }
      console.log('');

      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.log(`  ✗ ERROR: ${err.message}`);
      comparisons.push({
        id: baselineResult.id,
        query: baselineResult.query,
        error: err.message,
        degraded: true,
        reasons: ['Query failed']
      });
      degradedCount++;
      console.log('');
    }
  }

  // Summary
  console.log('=== RESULTS ===');
  console.log(`Label: ${label}`);
  console.log(`Degraded: ${degradedCount}/${comparisons.length}`);
  console.log(`OK: ${comparisons.length - degradedCount}/${comparisons.length}`);

  if (degradedCount > 0) {
    console.log('\n⚠ DEGRADATION DETECTED — Review before proceeding:');
    for (const c of comparisons.filter(c => c.degraded)) {
      console.log(`  Query ${c.id}: "${c.query}"`);
      for (const r of (c.reasons || [])) {
        console.log(`    → ${r}`);
      }
    }
    console.log('\nRecommendation: DELETE the just-uploaded document and diagnose.');
  } else {
    console.log('\n✓ All queries stable — safe to proceed.');
  }

  // Save comparison report
  const now = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = `baselines/comparison-${now}.json`;
  const report = {
    label,
    comparedAt: new Date().toISOString(),
    baselineFrom: baseline.capturedAt,
    degradedCount,
    totalQueries: comparisons.length,
    verdict: degradedCount === 0 ? 'PASS' : 'FAIL',
    comparisons
  };

  mkdirSync('baselines', { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved: ${reportPath}`);

  // Exit with error code if degraded (useful for automation)
  process.exit(degradedCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
