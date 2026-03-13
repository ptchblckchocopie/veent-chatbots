#!/usr/bin/env node
/**
 * Phase 3-4: Document Splitter
 *
 * Takes the senior dev's markdown and an analysis report,
 * then generates topic-focused sub-documents ready for Dify upload.
 *
 * Usage: node scripts/split-document.mjs <source.md> <analysis-report.json> [--output-dir output/]
 *
 * This script generates the actual .md files with:
 * - system- prefix naming
 * - Keyword-anchored headings
 * - Max 5000 chars per file
 * - Max 3 "event"/"ticket" mentions per 1024-char chunk
 * - No generic preambles
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const MAX_CHARS = 5000;
const CHUNK_SIZE = 1024;
const MAX_EVENT_PER_CHUNK = 3;
const MAX_TICKET_PER_CHUNK = 3;

function countInText(text, word) {
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  return (text.match(regex) || []).length;
}

function validateChunks(text, filename) {
  const warnings = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    const chunk = text.substring(i, i + CHUNK_SIZE);
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
    const eventCount = countInText(chunk, 'event') + countInText(chunk, 'events');
    const ticketCount = countInText(chunk, 'ticket') + countInText(chunk, 'tickets');

    if (eventCount > MAX_EVENT_PER_CHUNK) {
      warnings.push(`${filename} chunk ${chunkNum}: "event" appears ${eventCount}x (max ${MAX_EVENT_PER_CHUNK})`);
    }
    if (ticketCount > MAX_TICKET_PER_CHUNK) {
      warnings.push(`${filename} chunk ${chunkNum}: "ticket" appears ${ticketCount}x (max ${MAX_TICKET_PER_CHUNK})`);
    }
  }
  return warnings;
}

function extractSections(text) {
  const lines = text.split('\n');
  const sections = [];
  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    const headerMatch = lines[i].match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        level: headerMatch[1].length,
        title: headerMatch[2].trim(),
        rawHeader: lines[i],
        content: ''
      };
    } else if (currentSection) {
      currentSection.content += lines[i] + '\n';
    }
  }
  if (currentSection) sections.push(currentSection);
  return sections;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/split-document.mjs <source.md> <analysis-report.json> [--output-dir dir/]');
    process.exit(1);
  }

  const sourcePath = args[0];
  const reportPath = args[1];
  const outputDirIdx = args.indexOf('--output-dir');
  const outputDir = outputDirIdx !== -1 ? args[outputDirIdx + 1] : 'output';

  if (!existsSync(sourcePath)) {
    console.error(`Source file not found: ${sourcePath}`);
    process.exit(1);
  }
  if (!existsSync(reportPath)) {
    console.error(`Analysis report not found: ${reportPath}`);
    process.exit(1);
  }

  const sourceText = readFileSync(sourcePath, 'utf-8');
  const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
  const sections = extractSections(sourceText);

  console.log('=== DOCUMENT SPLITTER ===');
  console.log(`Source: ${basename(sourcePath)} (${sourceText.length} chars)`);
  console.log(`Analysis: ${basename(reportPath)}`);
  console.log(`Output: ${outputDir}/`);
  console.log(`Proposed docs: ${report.proposedDocs.length}`);
  console.log('');

  mkdirSync(outputDir, { recursive: true });

  // Build section lookup by title
  const sectionByTitle = {};
  for (const s of sections) {
    sectionByTitle[s.title] = s;
  }

  // Also build classification lookup from report
  const classificationByTitle = {};
  for (const rs of report.sections) {
    classificationByTitle[rs.title] = rs.classification;
  }

  const generatedFiles = [];
  const allWarnings = [];

  for (const proposed of report.proposedDocs) {
    console.log(`📄 Generating: ${proposed.filename}`);

    let content = '';
    let includedSections = 0;

    for (const sectionTitle of proposed.sections) {
      const section = sectionByTitle[sectionTitle];
      if (!section) {
        console.log(`  ⚠ Section not found: "${sectionTitle}" — skipping`);
        continue;
      }

      const classification = classificationByTitle[sectionTitle];
      if (classification === 'IRRELEVANT' || classification === 'OVERLAP-DUPLICATE') {
        console.log(`  ⊘ Skipping "${sectionTitle}" (${classification})`);
        continue;
      }

      // Add section with proper heading
      content += section.rawHeader + '\n' + section.content + '\n';
      includedSections++;
    }

    // Remove generic preambles
    content = content.replace(/^Veent Tix is a (platform|system|service) that[^\n]*\n/gm, '');
    content = content.replace(/^(Welcome to |Introduction to )[^\n]*\n/gm, '');

    // Trim trailing whitespace
    content = content.trim() + '\n';

    // Check size
    if (content.length > MAX_CHARS) {
      console.log(`  ⚠ Over limit: ${content.length} chars (max ${MAX_CHARS})`);
      console.log(`    → Truncating to ${MAX_CHARS} chars at last complete paragraph`);

      // Truncate at last paragraph boundary before MAX_CHARS
      const truncated = content.substring(0, MAX_CHARS);
      const lastParagraph = truncated.lastIndexOf('\n\n');
      if (lastParagraph > MAX_CHARS * 0.5) {
        content = truncated.substring(0, lastParagraph) + '\n';
      } else {
        content = truncated.substring(0, truncated.lastIndexOf('\n')) + '\n';
      }
    }

    // Validate chunks
    const warnings = validateChunks(content, proposed.filename);
    allWarnings.push(...warnings);

    if (warnings.length > 0) {
      console.log(`  ⚠ Keyword warnings:`);
      for (const w of warnings) {
        console.log(`    → ${w}`);
      }
    }

    // Write file
    const filePath = join(outputDir, proposed.filename);
    writeFileSync(filePath, content);
    console.log(`  ✓ Written: ${filePath} (${content.length} chars, ${includedSections} sections)`);
    generatedFiles.push({ filename: proposed.filename, path: filePath, chars: content.length, sections: includedSections, warnings });
    console.log('');
  }

  // Summary
  console.log('=== SUMMARY ===');
  console.log(`Generated: ${generatedFiles.length} files`);
  console.log(`Total chars: ${generatedFiles.reduce((sum, f) => sum + f.chars, 0)}`);
  console.log(`Warnings: ${allWarnings.length}`);
  console.log('');

  if (allWarnings.length > 0) {
    console.log('⚠ MANUAL REVIEW NEEDED for keyword pollution:');
    for (const w of allWarnings) {
      console.log(`  → ${w}`);
    }
    console.log('');
  }

  console.log('Files ready for upload (in recommended order):');
  // Sort by keyword isolation (files with fewer high-risk keywords first)
  const sortOrder = ['check-in', 'qr', 'notification', 'account', 'auth', 'organizer', 'payment', 'checkout'];
  const sorted = [...generatedFiles].sort((a, b) => {
    const aIdx = sortOrder.findIndex(s => a.filename.includes(s));
    const bIdx = sortOrder.findIndex(s => b.filename.includes(s));
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i];
    console.log(`  ${i + 1}. ${f.filename} (${f.chars} chars)`);
  }

  // Save manifest
  const manifestPath = join(outputDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: basename(sourcePath),
    files: sorted,
    uploadOrder: sorted.map(f => f.filename),
    warnings: allWarnings
  }, null, 2));
  console.log(`\nManifest saved: ${manifestPath}`);
}

main();
