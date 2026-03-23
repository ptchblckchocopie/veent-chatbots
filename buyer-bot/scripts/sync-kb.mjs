#!/usr/bin/env node
/**
 * Automated Knowledge Base Sync for Veent Tix Buyer Bot
 *
 * Crawls veent.io/discover for upcoming events, compares with existing
 * knowledge/*.md files, updates changed files, and re-uploads to Dify KB.
 *
 * Usage:
 *   npm run sync                    # full sync (crawl + compare + upload)
 *   npm run sync -- --dry-run       # crawl + compare only, no file changes or uploads
 *   npm run sync -- --no-upload     # update files but skip Dify upload
 *   npm run sync -- --month march   # only sync a specific month
 *
 * Environment:
 *   DIFY_DATASET_KEY  — Dataset API key (from Dify → Knowledge → API Access)
 *   DIFY_API_URL      — Dify API base URL (default: https://api.dify.ai/v1)
 *   DIFY_DATASET_ID   — Knowledge base ID (default: 15e17bd7-e876-4b0c-95d8-316ed3d5db12)
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// --- Configuration ---
const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
const DIFY_DATASET_KEY = process.env.DIFY_DATASET_KEY || '';
const DIFY_DATASET_ID = process.env.DIFY_DATASET_ID || '15e17bd7-e876-4b0c-95d8-316ed3d5db12';
const KNOWLEDGE_DIR = path.resolve(import.meta.dirname, '../../knowledge');
const BASE_URL = 'https://www.veent.io';

const DRY_RUN = process.argv.includes('--dry-run');
const NO_UPLOAD = process.argv.includes('--no-upload');
const MONTH_FILTER = (() => {
	const idx = process.argv.indexOf('--month');
	return idx !== -1 ? process.argv[idx + 1]?.toLowerCase() : null;
})();

const MONTH_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_ABBR = {
	january: 'jan', february: 'feb', march: 'mar', april: 'apr',
	may: 'may', june: 'jun', july: 'jul', august: 'aug',
	september: 'sep', october: 'oct', november: 'nov', december: 'dec'
};

// Month grouping rules: which months share a file
// Months not listed here get their own file
const MONTH_GROUPS = {
	'may': 'may-aug',
	'june': 'may-aug',
	'july': 'may-aug',
	'august': 'may-aug',
};

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeUrl(url) {
	try {
		const u = new URL(url);
		u.hash = '';
		return u.toString().replace(/\/$/, '');
	} catch {
		return url;
	}
}

// --- Crawling ---

async function extractEventLinks(browser) {
	const page = await browser.newPage();
	try {
		console.log('Opening veent.io/discover...');
		await page.goto(`${BASE_URL}/discover`, { waitUntil: 'networkidle', timeout: 30000 });

		// Click "See More Events" repeatedly to load all events
		for (let i = 0; i < 20; i++) {
			const btn = page.getByRole('button', { name: /see more/i });
			if ((await btn.count()) === 0) break;
			try {
				await btn.click();
				await delay(2000);
			} catch {
				break;
			}
		}

		const links = await page.$$eval('a[href]', anchors => anchors.map(a => a.href));
		const eventLinks = [...new Set(
			links
				.filter(l => /^https:\/\/[a-z0-9-]+\.veent\.net/.test(l))
				.map(normalizeUrl)
		)];

		console.log(`Found ${eventLinks.length} event links\n`);
		return eventLinks;
	} finally {
		await page.close();
	}
}

async function crawlEventPage(browser, url) {
	const page = await browser.newPage();
	try {
		await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

		const bodyText = await page.innerText('body');
		if (!bodyText || bodyText.length < 50) return null;

		const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);
		const fullText = lines.join('\n');

		// Event Name
		const eventName = await page.evaluate(() => {
			const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
			if (ogTitle && ogTitle.length > 2) return ogTitle;
			const title = document.title?.trim();
			if (title && title.length > 2) return title;
			return document.querySelector('h1')?.textContent?.trim() || '';
		}).catch(() => '') || '';

		if (!eventName) return null;

		// Date & Time from SSR meta
		const pageHtml = await page.content();
		const startTimeMatch = pageHtml.match(/startTime:"([^"]+)"/);
		const endTimeMatch = pageHtml.match(/endTime:"([^"]+)"/);

		let eventDate = '';
		let eventTime = '';
		let startDate = null;
		let endDate = null;
		let monthName = '';
		let year = '';

		// Convert UTC Date to Manila components (UTC+8)
		const toManila = (d) => {
			const ms = d.getTime() + 8 * 3600000;
			const m = new Date(ms);
			return {
				day: m.getUTCDate(),
				month: MONTH_NAMES[m.getUTCMonth()],
				year: m.getUTCFullYear(),
				dayName: DAY_NAMES[m.getUTCDay()],
				hours: m.getUTCHours(),
				minutes: m.getUTCMinutes()
			};
		};

		if (startTimeMatch) {
			startDate = new Date(startTimeMatch[1]);
			const s = toManila(startDate);
			monthName = s.month.toLowerCase();
			year = String(s.year);

			if (endTimeMatch) {
				endDate = new Date(endTimeMatch[1]);
				const e = toManila(endDate);

				// Multi-day event (different calendar dates in Manila time)
				if (e.day !== s.day || e.month !== s.month) {
					eventDate = `${s.dayName} to ${e.dayName}, ${s.month} ${s.day}-${e.day}, ${s.year}`;
				} else {
					eventDate = `${s.dayName}, ${s.month} ${s.day}, ${s.year}`;
				}
			} else {
				eventDate = `${s.dayName}, ${s.month} ${s.day}, ${s.year}`;
			}

			const formatTime = (d) => {
				const manila = toManila(d);
				const h = manila.hours;
				const min = manila.minutes;
				const ampm = h >= 12 ? 'PM' : 'AM';
				const h12 = h % 12 || 12;
				return `${h12}:${min.toString().padStart(2, '0')} ${ampm}`;
			};
			eventTime = formatTime(startDate);
			if (endTimeMatch) {
				eventTime += ` - ${formatTime(new Date(endTimeMatch[1]))}`;
			}
		}

		// Skip past events
		if (startDate && startDate.getTime() < Date.now() - 86400000) {
			return null;
		}

		// Venue
		const venue = await page.evaluate(() => {
			const infoDivs = document.querySelectorAll('div.flex.flex-col.gap-5 > div.flex.items-center.gap-4');
			for (const div of infoDivs) {
				if (div.className.includes('min-w')) continue;
				const t = div.textContent?.trim() || '';
				if (t.length > 2 && t.length < 200) return t;
			}
			const body = document.body.innerText || '';
			const venueMatch = body.match(/📍\s*(?:Venue:\s*)?(.+)/);
			if (venueMatch) return venueMatch[1].trim();
			return '';
		}).catch(() => '');

		// Ticket Tiers
		const tiers = [];
		const seenTiers = new Set();
		for (let i = 0; i < lines.length; i++) {
			const priceMatch = lines[i].match(/^(₱[\d,]+(?:\.\d{2})?)$/);
			if (priceMatch && i > 0) {
				const tierName = lines[i - 1];
				if (
					tierName.length > 1 && tierName.length < 60 &&
					!/₱|select|seat|next|book|choose|\d:\d|^\d+$/i.test(tierName)
				) {
					const key = `${tierName}:${priceMatch[1]}`;
					if (!seenTiers.has(key)) {
						seenTiers.add(key);
						tiers.push({ name: tierName, price: priceMatch[1] });
					}
				}
			}
		}

		return {
			eventName,
			url,
			eventDate,
			eventTime,
			venue,
			tiers,
			monthName,
			year,
			startDate
		};
	} catch (err) {
		console.warn(`  [error] ${url}: ${err.message}`);
		return null;
	} finally {
		await page.close();
	}
}

// --- Preserve keyword hints from existing KB files ---

function loadExistingAnnotations(filepath) {
	// Reads an existing KB file and extracts event name → annotated name mappings
	// e.g., "TJ Monterde and KZ Tandingan | In Between Bacolod (Concert, TJ Monterde, KZ Tandingan)"
	if (!fs.existsSync(filepath)) return {};
	const content = fs.readFileSync(filepath, 'utf-8');
	const annotations = {};
	const matches = content.matchAll(/^Event: (.+)$/gm);
	for (const m of matches) {
		const full = m[1];
		// Strip the parenthetical hint to get the base name
		const base = full.replace(/\s*\([^)]+\)\s*$/, '').trim();
		if (base !== full) {
			annotations[base] = full;
		}
	}
	return annotations;
}

// --- Format events into KB markdown ---

function formatEventBlock(event, annotations) {
	const name = annotations[event.eventName] || event.eventName;
	let block = `Event: ${name}\n`;
	block += `Event Link: ${event.url}\n`;
	if (event.eventDate) block += `Date: ${event.eventDate}\n`;
	if (event.eventTime) block += `Time: ${event.eventTime}\n`;
	if (event.venue) block += `Venue: ${event.venue}\n`;
	if (event.tiers.length > 0) {
		block += `Ticket Prices:\n`;
		for (const tier of event.tiers) {
			block += `- ${tier.name}: ${tier.price}\n`;
		}
	}
	return block.trimEnd();
}

function buildKBFile(events, monthLabel, yearLabel, annotations) {
	let content = `## Upcoming Events on Veent Tix — ${monthLabel} ${yearLabel}\n\n`;
	content += `Below is the list of upcoming events, event listings, and event schedules for ${monthLabel} ${yearLabel} on Veent Tix.\n\n`;
	content += events.map(e => formatEventBlock(e, annotations)).join('\n\n\n');
	content += '\n';
	return content;
}

function getFileKey(monthName) {
	// Returns the file key for a given month (e.g., 'mar', 'apr', 'may-aug')
	return MONTH_GROUPS[monthName] || MONTH_ABBR[monthName] || monthName.slice(0, 3);
}

function getMonthLabel(fileKey) {
	// Returns a display label for the file key
	const labels = {
		'may-aug': 'May, June, July, August',
	};
	if (labels[fileKey]) return labels[fileKey];
	const month = MONTH_NAMES.find(m => MONTH_ABBR[m.toLowerCase()] === fileKey);
	return month || fileKey;
}

// --- Dify API ---

async function listDifyDocuments() {
	if (!DIFY_DATASET_KEY) return [];

	const docs = [];
	let page = 1;
	while (true) {
		const res = await fetch(
			`${DIFY_API_URL}/datasets/${DIFY_DATASET_ID}/documents?page=${page}&limit=100`,
			{ headers: { 'Authorization': `Bearer ${DIFY_DATASET_KEY}` } }
		);
		if (!res.ok) {
			console.error(`  Failed to list Dify docs: HTTP ${res.status}`);
			return docs;
		}
		const data = await res.json();
		docs.push(...(data.data || []));
		if (!data.has_more) break;
		page++;
	}
	return docs;
}

async function deleteDifyDocument(documentId) {
	const res = await fetch(
		`${DIFY_API_URL}/datasets/${DIFY_DATASET_ID}/documents/${documentId}`,
		{
			method: 'DELETE',
			headers: { 'Authorization': `Bearer ${DIFY_DATASET_KEY}` }
		}
	);
	return res.ok;
}

async function uploadDifyDocument(name, text) {
	const res = await fetch(
		`${DIFY_API_URL}/datasets/${DIFY_DATASET_ID}/document/create-by-text`,
		{
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${DIFY_DATASET_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name,
				text,
				indexing_technique: 'high_quality',
				doc_form: 'text_model',
				doc_language: 'English',
				process_rule: {
					mode: 'custom',
					rules: {
						pre_processing_rules: [
							{ id: 'remove_extra_spaces', enabled: true },
							{ id: 'remove_urls_emails', enabled: false }
						],
						segmentation: {
							separator: '---',
							max_tokens: 4000
						}
					}
				}
			})
		}
	);

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Upload failed: HTTP ${res.status}: ${errText.substring(0, 300)}`);
	}

	return await res.json();
}

async function waitForIndexing(batch) {
	console.log('  Waiting for indexing...');
	const maxWait = 120000;
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
				if (allDone) {
					const hasError = docs.some(d => d.indexing_status === 'error');
					console.log(hasError ? '  ⚠ Indexing completed with errors' : '  ✓ Indexing complete');
					return !hasError;
				}
			}
		} catch { /* retry */ }
		await delay(3000);
	}
	console.log('  ⚠ Indexing timeout');
	return false;
}

// --- Main ---

async function main() {
	console.log('=== Veent KB Auto-Sync ===\n');
	console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : NO_UPLOAD ? 'update files only' : 'full sync'}`);
	if (MONTH_FILTER) console.log(`Month filter: ${MONTH_FILTER}`);
	if (!DIFY_DATASET_KEY && !NO_UPLOAD && !DRY_RUN) {
		console.log('⚠ DIFY_DATASET_KEY not set — will update files but skip Dify upload');
		console.log('  Get it from: Dify → Knowledge → API Access\n');
	}
	console.log('');

	// Step 1: Crawl events
	console.log('--- Step 1: Crawl veent.io ---\n');
	const browser = await chromium.launch({ headless: true });

	let events = [];
	try {
		const eventLinks = await extractEventLinks(browser);

		let count = 0;
		for (const url of eventLinks) {
			const event = await crawlEventPage(browser, url);
			if (event) {
				events.push(event);
				count++;
				console.log(`  [${count}] ${event.eventName} (${event.eventDate})`);
			}
			await delay(500);
		}
	} finally {
		await browser.close();
	}

	console.log(`\nCrawled ${events.length} upcoming events\n`);

	if (events.length === 0) {
		console.log('No upcoming events found. Exiting.');
		return;
	}

	// Step 2: Group by month/file
	console.log('--- Step 2: Group & compare ---\n');

	// Group events by file key
	const byFileKey = {};
	for (const event of events) {
		if (!event.monthName || !event.year) continue;

		// Apply month filter
		if (MONTH_FILTER && event.monthName !== MONTH_FILTER) continue;

		const fileKey = getFileKey(event.monthName);
		const key = `${fileKey}-${event.year}`;
		if (!byFileKey[key]) {
			byFileKey[key] = { fileKey, year: event.year, events: [] };
		}
		byFileKey[key].events.push(event);
	}

	// Sort events within each group by date
	for (const group of Object.values(byFileKey)) {
		group.events.sort((a, b) => {
			if (a.startDate && b.startDate) return a.startDate.getTime() - b.startDate.getTime();
			return 0;
		});
	}

	// Step 3: Compare with existing files and detect changes
	const changes = [];

	for (const [key, group] of Object.entries(byFileKey)) {
		const filename = `events-${key}.md`;
		const filepath = path.join(KNOWLEDGE_DIR, filename);
		const monthLabel = getMonthLabel(group.fileKey);

		// Load existing annotations (keyword hints like "(Concert, TJ Monterde)")
		const annotations = loadExistingAnnotations(filepath);
		const newContent = buildKBFile(group.events, monthLabel, group.year, annotations);

		const existingContent = fs.existsSync(filepath)
			? fs.readFileSync(filepath, 'utf-8')
			: null;

		// Compare: extract event names (strip annotations for comparison)
		const stripHint = (name) => name.replace(/\s*\([^)]+\)\s*$/, '').trim();
		const existingEvents = existingContent
			? [...existingContent.matchAll(/^Event: (.+)$/gm)].map(m => stripHint(m[1]))
			: [];
		const newEvents = group.events.map(e => e.eventName);

		const added = newEvents.filter(e => !existingEvents.includes(e));
		const removed = existingEvents.filter(e => !newEvents.includes(e));
		const contentChanged = existingContent !== newContent;

		if (!contentChanged) {
			console.log(`  ${filename}: no changes`);
			continue;
		}

		console.log(`  ${filename}: CHANGES DETECTED`);
		if (added.length > 0) console.log(`    + Added: ${added.join(', ')}`);
		if (removed.length > 0) console.log(`    - Removed: ${removed.join(', ')}`);
		if (added.length === 0 && removed.length === 0) console.log('    ~ Date/time/price/venue updates');

		changes.push({
			filename,
			filepath,
			content: newContent,
			eventCount: group.events.length,
			added,
			removed
		});
	}

	if (changes.length === 0) {
		console.log('\nNo changes detected. Knowledge base is up to date!');
		return;
	}

	console.log(`\n${changes.length} file(s) need updating\n`);

	if (DRY_RUN) {
		console.log('DRY RUN — no files modified, no uploads. Exiting.');
		return;
	}

	// Step 4: Update files
	console.log('--- Step 3: Update knowledge files ---\n');

	for (const change of changes) {
		fs.writeFileSync(change.filepath, change.content, 'utf-8');
		console.log(`  ✓ Updated ${change.filename} (${change.eventCount} events, ${change.content.length} chars)`);
	}

	// Step 5: Upload to Dify
	if (NO_UPLOAD || !DIFY_DATASET_KEY) {
		console.log('\nSkipping Dify upload. Files updated locally.');
		if (!DIFY_DATASET_KEY) {
			console.log('Set DIFY_DATASET_KEY to enable auto-upload to Dify.');
		}
		return;
	}

	console.log('\n--- Step 4: Upload to Dify ---\n');

	// List existing documents
	const difyDocs = await listDifyDocuments();
	console.log(`  Found ${difyDocs.length} documents in Dify KB\n`);

	for (const change of changes) {
		console.log(`  Processing: ${change.filename}`);

		// Find and delete existing document
		const existingDoc = difyDocs.find(d => d.name === change.filename);
		if (existingDoc) {
			console.log(`  Deleting old version (ID: ${existingDoc.id})...`);
			const deleted = await deleteDifyDocument(existingDoc.id);
			if (deleted) {
				console.log('  ✓ Old version deleted');
			} else {
				console.log('  ⚠ Delete failed — uploading new version anyway');
			}
			await delay(2000);
		}

		// Upload new version
		console.log('  Uploading new version...');
		try {
			const result = await uploadDifyDocument(change.filename, change.content);
			const docId = result.document?.id;
			console.log(`  ✓ Uploaded (doc ID: ${docId})`);

			if (result.batch) {
				await waitForIndexing(result.batch);
			} else {
				console.log('  Waiting 15s for indexing...');
				await delay(15000);
			}
		} catch (err) {
			console.error(`  ✗ Upload failed: ${err.message}`);
		}

		console.log('');
	}

	console.log('=== Sync complete! ===');
	console.log(`Updated ${changes.length} file(s) in knowledge/ and Dify KB.`);
}

main().catch(err => {
	console.error('Fatal error:', err);
	process.exit(1);
});
