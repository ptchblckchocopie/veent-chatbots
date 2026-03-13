#!/usr/bin/env node
/**
 * Phase 2-4: Document Analysis, Splitting & Overlap Resolution
 *
 * Analyzes the senior dev's system document and produces:
 * 1. Keyword frequency audit
 * 2. Section mapping with topic tags
 * 3. Overlap check against existing 6 Dify docs
 * 4. Split recommendations into topic-focused sub-documents
 *
 * Usage: node scripts/analyze-document.mjs <path-to-markdown-file>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { basename } from 'path';

// --- High-risk keywords that cause retrieval pollution ---
const HIGH_RISK_KEYWORDS = [
  'event', 'events', 'ticket', 'tickets', 'payment', 'pay',
  'account', 'organizer', 'refund', 'create', 'buy'
];

// --- Existing Dify documents and their primary keywords ---
const EXISTING_DOCS = {
  'about-veent-tix.md': {
    chars: 3019,
    topics: ['company info', 'contact', 'what is veent', 'support'],
    keywords: ['veent tix', 'platform', 'ticketing', 'support', 'contact', 'email', 'organizer']
  },
  'faq-and-policies.md': {
    chars: 4944,
    topics: ['refund', 'FAQ', 'terms', 'policies', 'privacy'],
    keywords: ['refund', 'policy', 'cancel', 'terms', 'privacy', 'data', 'faq']
  },
  'events-march-2026-v2.md': {
    chars: 6778,
    topics: ['march events', 'fun runs', 'concerts'],
    keywords: ['event', 'march', 'run', 'concert', 'ticket', 'date', 'venue']
  },
  'events-april-2026-v2.md': {
    chars: 5910,
    topics: ['april events', 'fun runs', 'concerts'],
    keywords: ['event', 'april', 'run', 'concert', 'ticket', 'date', 'venue']
  },
  'events-may-aug-2026-v2.md': {
    chars: 2602,
    topics: ['may-august events'],
    keywords: ['event', 'may', 'june', 'july', 'august', 'ticket', 'date']
  },
  'website-navigation-guide-v2.md': {
    chars: 8043,
    topics: ['navigation', 'how to buy', 'account creation', 'website usage'],
    keywords: ['click', 'navigate', 'button', 'page', 'step', 'login', 'account', 'buy', 'ticket']
  }
};

// --- Topic classification rules ---
const TOPIC_PATTERNS = [
  { topic: 'organizer-tools', patterns: ['organizer', 'dashboard', 'create event', 'manage event', 'listing', 'analytics', 'promotional', 'promo code'] },
  { topic: 'payment-processing', patterns: ['payment gateway', 'checkout', 'transaction', 'receipt', 'payment processing', 'billing', 'invoice'] },
  { topic: 'check-in-system', patterns: ['check-in', 'qr code', 'scan', 'entrance', 'admission', 'verify ticket', 'ticket scanning'] },
  { topic: 'account-management', patterns: ['authentication', 'login', 'password', 'sign up', 'sign in', 'account recovery', 'role', 'permission'] },
  { topic: 'notifications', patterns: ['notification', 'email notification', 'reminder', 'email delivery', 'sms', 'push notification'] },
  { topic: 'data-security', patterns: ['security', 'encryption', 'data protection', 'gdpr', 'compliance', 'audit'] },
  { topic: 'frontend-flow', patterns: ['frontend', 'ui', 'component', 'page flow', 'user interface', 'responsive', 'mobile'] },
  { topic: 'backend-logic', patterns: ['api', 'endpoint', 'server', 'database', 'migration', 'backend', 'middleware', 'route'] },
  { topic: 'event-management', patterns: ['event creation', 'event listing', 'event detail', 'venue', 'schedule', 'capacity'] },
  { topic: 'ticket-management', patterns: ['ticket type', 'ticket tier', 'seating', 'ticket generation', 'ticket validation'] },
  { topic: 'reporting', patterns: ['report', 'analytics', 'statistics', 'revenue', 'sales report', 'attendance'] }
];

function countKeywords(text) {
  const counts = {};
  const textLower = text.toLowerCase();
  for (const kw of HIGH_RISK_KEYWORDS) {
    // Word-boundary match
    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
    const matches = textLower.match(regex);
    counts[kw] = matches ? matches.length : 0;
  }
  return counts;
}

function extractSections(text) {
  const lines = text.split('\n');
  const sections = [];
  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match H1, H2, H3 headers
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);

    if (headerMatch) {
      if (currentSection) {
        currentSection.endLine = i - 1;
        currentSection.charCount = currentSection.content.length;
        sections.push(currentSection);
      }
      currentSection = {
        level: headerMatch[1].length,
        title: headerMatch[2].trim(),
        startLine: i + 1,
        content: '',
        topics: [],
        overlap: null
      };
    } else if (currentSection) {
      currentSection.content += line + '\n';
    }
  }

  if (currentSection) {
    currentSection.endLine = lines.length - 1;
    currentSection.charCount = currentSection.content.length;
    sections.push(currentSection);
  }

  return sections;
}

function classifySection(section) {
  const textLower = (section.title + ' ' + section.content).toLowerCase();
  const matches = [];

  for (const tp of TOPIC_PATTERNS) {
    let score = 0;
    for (const pattern of tp.patterns) {
      if (textLower.includes(pattern)) score++;
    }
    if (score > 0) {
      matches.push({ topic: tp.topic, score });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 3); // Top 3 topics
}

function checkOverlap(section) {
  const textLower = (section.title + ' ' + section.content).toLowerCase();
  const overlaps = [];

  for (const [docName, doc] of Object.entries(EXISTING_DOCS)) {
    let matchCount = 0;
    for (const kw of doc.keywords) {
      if (textLower.includes(kw.toLowerCase())) matchCount++;
    }
    const overlapRatio = matchCount / doc.keywords.length;
    if (overlapRatio > 0.3) {
      overlaps.push({
        document: docName,
        overlapRatio: Math.round(overlapRatio * 100),
        matchedKeywords: matchCount,
        totalKeywords: doc.keywords.length,
        topics: doc.topics
      });
    }
  }

  overlaps.sort((a, b) => b.overlapRatio - a.overlapRatio);
  return overlaps;
}

function classifyOverlap(section, overlaps) {
  const textLower = section.content.toLowerCase();

  // Check for developer-internal content
  const devPatterns = ['api endpoint', 'database schema', 'migration', 'middleware',
    'docker', 'deployment', 'npm', 'package.json', 'environment variable',
    'server config', 'nginx', 'ssl', 'ci/cd', 'pipeline'];
  const devScore = devPatterns.filter(p => textLower.includes(p)).length;

  if (devScore >= 3) {
    return 'IRRELEVANT'; // Pure developer internals
  }

  if (overlaps.length === 0) {
    return 'NEW';
  }

  // If high overlap but section has more detail (longer content)
  const topOverlap = overlaps[0];
  const existingDoc = EXISTING_DOCS[topOverlap.document];
  if (topOverlap.overlapRatio >= 70) {
    if (section.charCount > existingDoc.chars * 0.3) {
      return 'OVERLAP-BETTER'; // Probably more detailed
    }
    return 'OVERLAP-DUPLICATE';
  }

  if (topOverlap.overlapRatio >= 40) {
    return 'OVERLAP-BETTER'; // Partial overlap, likely adds value
  }

  return 'NEW';
}

function proposeSplits(sections) {
  const MAX_CHARS = 5000;
  const TARGET_MIN = 2000;
  const TARGET_MAX = 4000;

  // Group sections by primary topic
  const topicGroups = {};

  for (const section of sections) {
    if (section.classification === 'IRRELEVANT' || section.classification === 'OVERLAP-DUPLICATE') {
      continue;
    }

    const primaryTopic = section.topics.length > 0 ? section.topics[0].topic : 'general';

    if (!topicGroups[primaryTopic]) {
      topicGroups[primaryTopic] = { sections: [], totalChars: 0 };
    }
    topicGroups[primaryTopic].sections.push(section);
    topicGroups[primaryTopic].totalChars += section.charCount;
  }

  const proposedDocs = [];

  for (const [topic, group] of Object.entries(topicGroups)) {
    if (group.totalChars < 200) continue; // Skip tiny topics

    if (group.totalChars <= MAX_CHARS) {
      // Fits in one document
      proposedDocs.push({
        filename: `system-${topic}.md`,
        topic,
        sections: group.sections.map(s => s.title),
        estimatedChars: group.totalChars,
        withinTarget: group.totalChars >= TARGET_MIN && group.totalChars <= TARGET_MAX,
        needsSplit: false
      });
    } else {
      // Needs splitting
      let currentDoc = { sections: [], chars: 0 };
      let partNum = 1;

      for (const section of group.sections) {
        if (currentDoc.chars + section.charCount > MAX_CHARS && currentDoc.sections.length > 0) {
          proposedDocs.push({
            filename: `system-${topic}-part${partNum}.md`,
            topic,
            sections: currentDoc.sections.map(s => s.title),
            estimatedChars: currentDoc.chars,
            withinTarget: currentDoc.chars >= TARGET_MIN && currentDoc.chars <= TARGET_MAX,
            needsSplit: false
          });
          partNum++;
          currentDoc = { sections: [], chars: 0 };
        }
        currentDoc.sections.push(section);
        currentDoc.chars += section.charCount;
      }

      if (currentDoc.sections.length > 0) {
        proposedDocs.push({
          filename: partNum > 1 ? `system-${topic}-part${partNum}.md` : `system-${topic}.md`,
          topic,
          sections: currentDoc.sections.map(s => s.title),
          estimatedChars: currentDoc.chars,
          withinTarget: currentDoc.chars >= TARGET_MIN && currentDoc.chars <= TARGET_MAX,
          needsSplit: false
        });
      }
    }
  }

  return proposedDocs;
}

function generateKeywordReport(sections) {
  // Count keywords across all proposed sections (excluding IRRELEVANT/DUPLICATE)
  const kept = sections.filter(s => s.classification !== 'IRRELEVANT' && s.classification !== 'OVERLAP-DUPLICATE');

  // Per-section keyword counts
  const sectionCounts = kept.map(s => ({
    title: s.title,
    keywords: countKeywords(s.content)
  }));

  // Per-chunk keyword check (simulate 1024 char chunks)
  const chunkWarnings = [];
  for (const section of kept) {
    const chunks = [];
    for (let i = 0; i < section.content.length; i += 1024) {
      chunks.push(section.content.substring(i, i + 1024));
    }
    for (let ci = 0; ci < chunks.length; ci++) {
      const chunkKw = countKeywords(chunks[ci]);
      const eventCount = (chunkKw['event'] || 0) + (chunkKw['events'] || 0);
      const ticketCount = (chunkKw['ticket'] || 0) + (chunkKw['tickets'] || 0);
      if (eventCount > 3) {
        chunkWarnings.push(`${section.title} chunk ${ci + 1}: "event" appears ${eventCount}x (max 3)`);
      }
      if (ticketCount > 3) {
        chunkWarnings.push(`${section.title} chunk ${ci + 1}: "ticket" appears ${ticketCount}x (max 3)`);
      }
    }
  }

  return { sectionCounts, chunkWarnings };
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/analyze-document.mjs <path-to-markdown-file>');
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const text = readFileSync(filePath, 'utf-8');
  const filename = basename(filePath);

  console.log('=== DOCUMENT ANALYSIS ===');
  console.log(`File: ${filename}`);
  console.log(`Size: ${text.length} chars, ${text.split(/\s+/).length} words`);
  console.log('');

  // Phase 2a: Keyword frequency audit
  console.log('--- KEYWORD FREQUENCY AUDIT ---');
  const globalKeywords = countKeywords(text);
  for (const [kw, count] of Object.entries(globalKeywords).sort((a, b) => b[1] - a[1])) {
    const bar = '█'.repeat(Math.min(count, 50));
    const warning = count > 20 ? ' ⚠ HIGH' : count > 10 ? ' ⚠ MODERATE' : '';
    console.log(`  ${kw.padEnd(12)} ${String(count).padStart(4)} ${bar}${warning}`);
  }
  console.log('');

  // Phase 2b: Section mapping
  console.log('--- SECTION MAPPING ---');
  const sections = extractSections(text);
  console.log(`Found ${sections.length} sections\n`);

  for (const section of sections) {
    section.topics = classifySection(section);
    const overlaps = checkOverlap(section);
    section.overlaps = overlaps;
    section.classification = classifyOverlap(section, overlaps);
    section.sectionKeywords = countKeywords(section.content);

    const topicStr = section.topics.length > 0
      ? section.topics.map(t => `${t.topic}(${t.score})`).join(', ')
      : 'general';

    const overlapStr = overlaps.length > 0
      ? overlaps.map(o => `${o.document}(${o.overlapRatio}%)`).join(', ')
      : 'none';

    const icon = {
      'NEW': '🆕',
      'OVERLAP-BETTER': '📝',
      'OVERLAP-DUPLICATE': '🔁',
      'IRRELEVANT': '⛔'
    }[section.classification] || '❓';

    console.log(`  ${'#'.repeat(section.level)} ${section.title}`);
    console.log(`     ${icon} ${section.classification} | ${section.charCount} chars | Topics: ${topicStr}`);
    if (overlaps.length > 0) {
      console.log(`     Overlaps: ${overlapStr}`);
    }
    console.log('');
  }

  // Phase 3: Split recommendations
  console.log('--- SPLIT RECOMMENDATIONS ---');
  const proposedDocs = proposeSplits(sections);

  if (proposedDocs.length === 0) {
    console.log('  No documents to create (all content is duplicate/irrelevant)');
  } else {
    console.log(`  Proposed ${proposedDocs.length} new documents:\n`);
    for (const doc of proposedDocs) {
      const sizeIcon = doc.withinTarget ? '✓' : doc.estimatedChars > 5000 ? '⚠ OVER LIMIT' : '○';
      console.log(`  📄 ${doc.filename} (${doc.estimatedChars} chars) ${sizeIcon}`);
      console.log(`     Topic: ${doc.topic}`);
      console.log(`     Sections: ${doc.sections.join(', ')}`);
      console.log('');
    }
  }

  // Phase 4: Keyword pollution check
  console.log('--- KEYWORD POLLUTION CHECK ---');
  const { sectionCounts, chunkWarnings } = generateKeywordReport(sections);

  if (chunkWarnings.length === 0) {
    console.log('  ✓ No chunk-level keyword pollution detected');
  } else {
    console.log(`  ⚠ ${chunkWarnings.length} chunk(s) exceed keyword limits:\n`);
    for (const w of chunkWarnings) {
      console.log(`    → ${w}`);
    }
  }
  console.log('');

  // Summary
  const counts = {
    NEW: sections.filter(s => s.classification === 'NEW').length,
    'OVERLAP-BETTER': sections.filter(s => s.classification === 'OVERLAP-BETTER').length,
    'OVERLAP-DUPLICATE': sections.filter(s => s.classification === 'OVERLAP-DUPLICATE').length,
    'IRRELEVANT': sections.filter(s => s.classification === 'IRRELEVANT').length
  };

  console.log('=== SUMMARY ===');
  console.log(`  Sections: ${sections.length} total`);
  console.log(`    NEW: ${counts.NEW} → Create new sub-documents`);
  console.log(`    OVERLAP-BETTER: ${counts['OVERLAP-BETTER']} → Update existing docs`);
  console.log(`    OVERLAP-DUPLICATE: ${counts['OVERLAP-DUPLICATE']} → Skip`);
  console.log(`    IRRELEVANT: ${counts['IRRELEVANT']} → Skip (dev internals)`);
  console.log(`  Proposed new docs: ${proposedDocs.length}`);
  console.log(`  Total new chars: ${proposedDocs.reduce((sum, d) => sum + d.estimatedChars, 0)}`);

  // Save analysis report
  const reportPath = `baselines/analysis-${basename(filePath, '.md')}.json`;
  mkdirSync('baselines', { recursive: true });
  const report = {
    analyzedAt: new Date().toISOString(),
    file: filename,
    fileChars: text.length,
    fileWords: text.split(/\s+/).length,
    globalKeywords,
    sectionCount: sections.length,
    classifications: counts,
    sections: sections.map(s => ({
      title: s.title,
      level: s.level,
      charCount: s.charCount,
      classification: s.classification,
      topics: s.topics,
      overlaps: s.overlaps,
      keywords: s.sectionKeywords
    })),
    proposedDocs,
    chunkWarnings
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report saved: ${reportPath}`);
}

main();
