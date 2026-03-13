#!/usr/bin/env node
/**
 * Phase 5: Upload-and-Test Automation
 *
 * Uploads documents one at a time to Dify Knowledge Base, waits for indexing,
 * then runs all 10 baseline queries to check for degradation.
 *
 * Supports two modes:
 * - API mode: Set DIFY_DATASET_KEY env var to auto-upload via Dify Dataset API
 * - Manual mode: Prompts you to upload via Dify UI, then runs tests
 *
 * Usage:
 *   node scripts/upload-and-test.mjs --baseline baselines/baseline-2026-03-12.json --docs output/
 *   node scripts/upload-and-test.mjs --baseline <path> --docs <dir> [--start-from 1] [--dry-run]
 *
 * Environment:
 *   DIFY_API_KEY      — App API key for chat queries (default: app-GARtGz5zAZ5SHo3zTgxLND5N)
 *   DIFY_API_URL      — Dify API base URL (default: https://api.dify.ai/v1)
 *   DIFY_DATASET_KEY  — Dataset API key for KB uploads (get from Dify → Knowledge → API Access)
 *   DIFY_DATASET_ID   — Knowledge base ID (default: 15e17bd7-e876-4b0c-95d8-316ed3d5db12)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { createInterface } from 'readline';

// --- Configuration ---
const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
const DIFY_API_KEY = process.env.DIFY_API_KEY || 'app-GARtGz5zAZ5SHo3zTgxLND5N';
const DIFY_DATASET_KEY = process.env.DIFY_DATASET_KEY || '';
const DIFY_DATASET_ID = process.env.DIFY_DATASET_ID || '15e17bd7-e876-4b0c-95d8-316ed3d5db12';

// Recommended upload order (most isolated keywords → highest risk)
const UPLOAD_ORDER = [
  'system-check-in',
  'system-notification',
  'system-account',
  'system-organizer',
  'system-payment'
];

function sortByUploadOrder(files) {
  return [...files].sort((a, b) => {
    const aIdx = UPLOAD_ORDER.findIndex(prefix => a.includes(prefix));
    const bIdx = UPLOAD_ORDER.findIndex(prefix => b.includes(prefix));
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

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
          user: 'upload-test'
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

async function uploadViaAPI(docName, docText) {
  if (!DIFY_DATASET_KEY) {
    throw new Error('DIFY_DATASET_KEY not set');
  }

  const res = await fetch(`${DIFY_API_URL}/datasets/${DIFY_DATASET_ID}/document/create_by_text`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIFY_DATASET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: docName,
      text: docText,
      indexing_technique: 'economy',
      process_rule: {
        mode: 'custom',
        rules: {
          pre_processing_rules: [
            { id: 'remove_extra_spaces', enabled: true },
            { id: 'remove_urls_emails', enabled: false }
          ],
          segmentation: {
            separator: '###',
            max_tokens: 1024
          }
        }
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upload failed: HTTP ${res.status}: ${errText.substring(0, 300)}`);
  }

  const data = await res.json();
  return data;
}

async function waitForIndexing(batch) {
  if (!DIFY_DATASET_KEY) return;

  console.log('  Waiting for indexing...');
  const maxWait = 120000; // 2 minutes
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(
        `${DIFY_API_URL}/datasets/${DIFY_DATASET_ID}/documents/${batch}/indexing-status`,
        { headers: { 'Authorization': `Bearer ${DIFY_DATASET_KEY}` } }
      );

      if (res.ok) {
        const data = await res.json();
        const docs = data.data || [];
        const allDone = docs.every(d => d.indexing_status === 'completed' || d.indexing_status === 'error');
        const hasError = docs.some(d => d.indexing_status === 'error');

        if (hasError) {
          throw new Error('Indexing failed with error status');
        }

        if (allDone) {
          const segments = docs.reduce((sum, d) => sum + (d.completed_segments || 0), 0);
          console.log(`  ✓ Indexing complete (${segments} segments)`);
          return;
        }

        const progress = docs.map(d => `${d.completed_segments || 0}/${d.total_segments || '?'}`).join(', ');
        process.stdout.write(`  ...indexing: ${progress}\r`);
      }
    } catch (err) {
      if (err.message.includes('error status')) throw err;
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('  ⚠ Indexing timeout — proceeding with tests anyway');
}

async function deleteDocument(documentId) {
  if (!DIFY_DATASET_KEY) {
    console.log(`  ⚠ Cannot auto-delete without DIFY_DATASET_KEY. Delete manually in Dify UI.`);
    return;
  }

  const res = await fetch(
    `${DIFY_API_URL}/datasets/${DIFY_DATASET_ID}/documents/${documentId}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${DIFY_DATASET_KEY}` }
    }
  );

  if (!res.ok) {
    console.log(`  ⚠ Delete failed: HTTP ${res.status}`);
  } else {
    console.log(`  ✓ Document deleted`);
  }
}

function compareAnswers(baselineResult, newAnswer) {
  const reasons = [];

  if (!newAnswer || newAnswer.trim().length === 0) {
    return { degraded: true, reasons: ['Empty answer'] };
  }

  const baselineKeywords = baselineResult.expectedKeywords || [];
  const newAnswerLower = newAnswer.toLowerCase();
  const baselineAnswerLower = (baselineResult.answer || '').toLowerCase();

  const lostKeywords = [];
  for (const kw of baselineKeywords) {
    const kwLower = kw.toLowerCase();
    if (baselineAnswerLower.includes(kwLower) && !newAnswerLower.includes(kwLower)) {
      lostKeywords.push(kw);
    }
  }

  if (lostKeywords.length > 0) {
    reasons.push(`Lost keywords: ${lostKeywords.join(', ')}`);
  }

  const baselineLen = (baselineResult.answer || '').length;
  if (baselineLen > 0 && newAnswer.length < baselineLen * 0.5) {
    reasons.push(`Answer shortened from ${baselineLen} to ${newAnswer.length} chars`);
  }

  const copoutPhrases = ['visit the website', 'check the website', "i don't have information", "i'm not sure", 'i cannot find'];
  const hasCopout = copoutPhrases.some(p => newAnswerLower.includes(p));
  const baselineHadCopout = copoutPhrases.some(p => baselineAnswerLower.includes(p));
  if (hasCopout && !baselineHadCopout) {
    reasons.push('New answer contains generic copout phrase');
  }

  const keywordLossRatio = baselineKeywords.length > 0 ? lostKeywords.length / baselineKeywords.length : 0;
  const degraded = keywordLossRatio > 0.3 || (hasCopout && !baselineHadCopout) || reasons.length >= 2;

  return { degraded, reasons, lostKeywords };
}

async function runBaselineTests(baseline) {
  const results = [];
  let degradedCount = 0;

  for (const baselineResult of baseline.results) {
    if (baselineResult.status === 'ERROR') continue;

    console.log(`  [${baselineResult.id}/10] "${baselineResult.query}"`);

    try {
      const response = await sendQuery(baselineResult.query);
      const comparison = compareAnswers(baselineResult, response.answer);

      if (comparison.degraded) {
        degradedCount++;
        console.log(`    ✗ DEGRADED`);
        for (const r of comparison.reasons) console.log(`      → ${r}`);
      } else {
        console.log(`    ✓ OK`);
      }

      results.push({
        id: baselineResult.id,
        query: baselineResult.query,
        newAnswer: response.answer,
        ...comparison
      });

      // Rate limit delay (Groq free tier: 6K TPM)
      await new Promise(r => setTimeout(r, 8000));
    } catch (err) {
      console.log(`    ✗ ERROR: ${err.message.substring(0, 100)}`);
      results.push({
        id: baselineResult.id,
        query: baselineResult.query,
        degraded: true,
        reasons: [`Query error: ${err.message.substring(0, 100)}`]
      });
      degradedCount++;
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  return { results, degradedCount };
}

async function main() {
  const args = process.argv.slice(2);
  const baselineIdx = args.indexOf('--baseline');
  const docsIdx = args.indexOf('--docs');
  const startFromIdx = args.indexOf('--start-from');
  const dryRun = args.includes('--dry-run');

  if (baselineIdx === -1 || docsIdx === -1) {
    console.error('Usage: node scripts/upload-and-test.mjs --baseline <path> --docs <dir> [--start-from N] [--dry-run]');
    process.exit(1);
  }

  const baselinePath = args[baselineIdx + 1];
  const docsDir = args[docsIdx + 1];
  const startFrom = startFromIdx !== -1 ? parseInt(args[startFromIdx + 1]) : 1;

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
  const apiMode = !!DIFY_DATASET_KEY;

  // Get document files sorted by upload order
  const allFiles = readdirSync(docsDir).filter(f => f.startsWith('system-') && f.endsWith('.md'));
  const sortedFiles = sortByUploadOrder(allFiles);

  console.log('=== UPLOAD & TEST AUTOMATION ===');
  console.log(`Mode: ${apiMode ? 'API (auto-upload)' : 'Manual (upload via Dify UI)'}`);
  console.log(`Baseline: ${baselinePath} (from ${baseline.capturedAt})`);
  console.log(`Documents: ${sortedFiles.length} in ${docsDir}/`);
  console.log(`Starting from: #${startFrom}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  console.log('Upload order:');
  for (let i = 0; i < sortedFiles.length; i++) {
    const content = readFileSync(join(docsDir, sortedFiles[i]), 'utf-8');
    console.log(`  ${i + 1}. ${sortedFiles[i]} (${content.length} chars)`);
  }
  console.log('');

  if (dryRun) {
    console.log('Dry run — exiting without uploading or testing.');
    return;
  }

  // Process each document
  const uploadLog = [];

  for (let i = startFrom - 1; i < sortedFiles.length; i++) {
    const filename = sortedFiles[i];
    const filePath = join(docsDir, filename);
    const content = readFileSync(filePath, 'utf-8');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`DOCUMENT ${i + 1}/${sortedFiles.length}: ${filename}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Size: ${content.length} chars`);

    let documentId = null;

    // Upload
    if (apiMode) {
      console.log('\nUploading via API...');
      try {
        const uploadResult = await uploadViaAPI(filename, content);
        const doc = uploadResult.document || {};
        documentId = doc.id;
        const batch = uploadResult.batch || '';
        console.log(`  ✓ Uploaded (doc ID: ${documentId})`);

        if (batch) {
          await waitForIndexing(batch);
        } else {
          console.log('  Waiting 15s for indexing...');
          await new Promise(r => setTimeout(r, 15000));
        }
      } catch (err) {
        console.log(`  ✗ Upload error: ${err.message}`);
        console.log('  Falling back to manual upload.');
      }
    }

    if (!documentId) {
      // Manual mode
      console.log('\n📋 MANUAL UPLOAD REQUIRED:');
      console.log(`  1. Open: https://cloud.dify.ai/datasets/${DIFY_DATASET_ID}/documents`);
      console.log(`  2. Click "Add file" → Upload: ${filePath}`);
      console.log(`  3. Settings: General mode, 1024 max chunk, 50 overlap, Economical index`);
      console.log(`  4. Click "Save & Process" → Wait for indexing to complete`);

      const answer = await prompt('\nPress ENTER when upload & indexing are done (or type "skip" to skip): ');
      if (answer.toLowerCase() === 'skip') {
        console.log('Skipping this document.');
        uploadLog.push({ filename, status: 'skipped' });
        continue;
      }
    }

    // Run baseline tests
    console.log('\nRunning baseline tests...');
    const testResult = await runBaselineTests(baseline);

    console.log(`\nResults: ${testResult.degradedCount === 0 ? '✓ ALL PASS' : `✗ ${testResult.degradedCount} DEGRADED`}`);

    if (testResult.degradedCount > 0) {
      console.log('\n⚠ DEGRADATION DETECTED after uploading ' + filename);
      console.log('Recommendation: DELETE this document and diagnose.\n');

      if (apiMode && documentId) {
        const answer = await prompt('Auto-delete this document? (y/N): ');
        if (answer.toLowerCase() === 'y') {
          await deleteDocument(documentId);
        }
      } else {
        console.log(`Manual action: Delete "${filename}" from Dify Knowledge Base`);
        console.log(`URL: https://cloud.dify.ai/datasets/${DIFY_DATASET_ID}/documents`);
      }

      const continueAnswer = await prompt('Continue with next document? (y/N): ');
      if (continueAnswer.toLowerCase() !== 'y') {
        console.log('Stopping upload process.');
        uploadLog.push({ filename, status: 'degraded-stopped', testResult });
        break;
      }

      uploadLog.push({ filename, status: 'degraded-removed', documentId, testResult });
    } else {
      console.log(`✓ ${filename} uploaded successfully — no degradation detected.`);
      uploadLog.push({ filename, status: 'success', documentId, testResult });

      if (i < sortedFiles.length - 1) {
        console.log(`\nNext: ${sortedFiles[i + 1]}`);
      }
    }
  }

  // Save upload log
  const logPath = `baselines/upload-log-${new Date().toISOString().slice(0, 10)}.json`;
  mkdirSync('baselines', { recursive: true });
  writeFileSync(logPath, JSON.stringify({
    completedAt: new Date().toISOString(),
    mode: apiMode ? 'api' : 'manual',
    baselineFrom: baseline.capturedAt,
    uploads: uploadLog
  }, null, 2));
  console.log(`\nUpload log saved: ${logPath}`);

  // Final summary
  console.log('\n=== FINAL SUMMARY ===');
  const success = uploadLog.filter(u => u.status === 'success').length;
  const degraded = uploadLog.filter(u => u.status.includes('degraded')).length;
  const skipped = uploadLog.filter(u => u.status === 'skipped').length;
  console.log(`Success: ${success} | Degraded: ${degraded} | Skipped: ${skipped}`);

  if (success === sortedFiles.length) {
    console.log('\n✓ All documents uploaded successfully!');
    console.log('Next step: Run post-integration validation:');
    console.log('  node scripts/post-validation.mjs --baseline baselines/baseline-2026-03-12.json');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
