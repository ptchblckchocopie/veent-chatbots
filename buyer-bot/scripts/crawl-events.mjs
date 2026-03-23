/**
 * Knowledge Base Crawler for Veent.io
 *
 * Two phases:
 *   Phase 1: Crawl main veent.io pages (about, FAQ, how it works, etc.)
 *   Phase 2: Crawl all event pages from veent.io/discover
 *
 * Usage:
 *   npm run crawl                       # all events (past + upcoming)
 *   npm run crawl -- --upcoming-only    # only upcoming events
 *   npm run crawl -- --events-only      # skip main site, events only
 *   npm run crawl -- --site-only        # skip events, main site only
 *
 * Output:
 *   tmp/veent-site-info.md             (main site content)
 *   tmp/events-<month>-<year>.md       (one file per month)
 *   tmp/all-events.md                  (combined, for reference)
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://www.veent.io';
const OUTPUT_DIR = 'tmp';
const UPCOMING_ONLY = process.argv.includes('--upcoming-only');
const EVENTS_ONLY = process.argv.includes('--events-only');
const SITE_ONLY = process.argv.includes('--site-only');

// Pages to crawl from the main veent.io site
const MAIN_SITE_PAGES = [
	{ url: `${BASE_URL}`, label: 'Homepage' },
	{ url: `${BASE_URL}/discover`, label: 'Discover Events' },
	{ url: `${BASE_URL}/about`, label: 'About Veent' },
	{ url: `${BASE_URL}/faq`, label: 'FAQ' },
	{ url: `${BASE_URL}/how-it-works`, label: 'How It Works' },
	{ url: `${BASE_URL}/contact`, label: 'Contact' },
	{ url: `${BASE_URL}/terms`, label: 'Terms & Conditions' },
	{ url: `${BASE_URL}/privacy`, label: 'Privacy Policy' },
	{ url: `${BASE_URL}/pricing`, label: 'Pricing' },
	{ url: `${BASE_URL}/for-organizers`, label: 'For Organizers' },
	{ url: `${BASE_URL}/help`, label: 'Help Center' },
];

const MONTH_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_ABBR_MAP = {
	jan: 'January', feb: 'February', mar: 'March', apr: 'April',
	may: 'May', jun: 'June', jul: 'July', aug: 'August',
	sep: 'September', oct: 'October', nov: 'November', dec: 'December'
};

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
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

// --- Phase 1: Crawl main site pages ---

async function crawlMainSite(browser) {
	console.log('=== Phase 1: Crawling main veent.io pages ===\n');
	const pages = [];

	for (const { url, label } of MAIN_SITE_PAGES) {
		const page = await browser.newPage();
		try {
			const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });

			// Skip pages that don't exist (404, redirects to home, etc.)
			if (!response || response.status() >= 400) {
				console.log(`  [skip] ${label} (${url}) — ${response?.status() || 'no response'}`);
				continue;
			}

			// Check if we got redirected to the homepage (page doesn't exist)
			const finalUrl = page.url();
			if (finalUrl !== url && finalUrl === `${BASE_URL}/` && url !== BASE_URL) {
				console.log(`  [skip] ${label} (${url}) — redirected to homepage`);
				continue;
			}

			const bodyText = await page.innerText('body');
			if (!bodyText || bodyText.length < 100) {
				console.log(`  [skip] ${label} — too little content`);
				continue;
			}

			// Get page title
			const title = await page.evaluate(() => {
				const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
				return ogTitle || document.title?.trim() || '';
			});

			// Get meta description
			const metaDesc = await page.evaluate(() => {
				return document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ||
					document.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || '';
			});

			// Extract meaningful text content (skip nav, footer boilerplate)
			const content = await page.evaluate(() => {
				// Try to get main content area
				const main = document.querySelector('main') || document.querySelector('[role="main"]');
				const container = main || document.body;

				// Remove nav, footer, script elements from consideration
				const clone = container.cloneNode(true);
				clone.querySelectorAll('nav, footer, script, style, header').forEach(el => el.remove());

				const text = clone.innerText || '';
				// Clean up: collapse whitespace, remove empty lines
				return text
					.split('\n')
					.map(l => l.trim())
					.filter(l => l.length > 0)
					.join('\n');
			});

			if (content.length < 50) {
				console.log(`  [skip] ${label} — no meaningful content after cleanup`);
				continue;
			}

			pages.push({
				url,
				label,
				title,
				metaDesc,
				content
			});

			console.log(`  [ok] ${label} — ${content.length.toLocaleString()} chars`);
		} catch (err) {
			console.log(`  [error] ${label} (${url}): ${err.message}`);
		} finally {
			await page.close();
		}
		await delay(500);
	}

	// Also discover any additional links from the homepage footer/nav
	if (pages.length > 0) {
		const page = await browser.newPage();
		try {
			await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
			const allLinks = await page.$$eval('a[href]', (anchors) =>
				anchors.map(a => ({ href: a.href, text: a.textContent?.trim() || '' }))
			);

			// Find internal links we haven't crawled yet
			const crawledUrls = new Set([...pages.map(p => p.url), ...MAIN_SITE_PAGES.map(p => p.url)]);
			const newLinks = allLinks
				.filter(l =>
					l.href.startsWith(BASE_URL) &&
					!crawledUrls.has(normalizeUrl(l.href)) &&
					!l.href.includes('/discover') &&
					!/\.(png|jpg|svg|css|js)/.test(l.href) &&
					l.text.length > 1
				)
				.map(l => ({ url: normalizeUrl(l.href), label: l.text }));

			// Dedupe
			const seen = new Set();
			const uniqueNewLinks = newLinks.filter(l => {
				if (seen.has(l.url)) return false;
				seen.add(l.url);
				return true;
			});

			if (uniqueNewLinks.length > 0) {
				console.log(`\n  Found ${uniqueNewLinks.length} additional site pages:`);
				for (const { url, label } of uniqueNewLinks.slice(0, 10)) {
					const subPage = await browser.newPage();
					try {
						const resp = await subPage.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
						if (!resp || resp.status() >= 400) continue;

						const finalUrl = subPage.url();
						if (finalUrl !== url && finalUrl === `${BASE_URL}/`) continue;

						const content = await subPage.evaluate(() => {
							const main = document.querySelector('main') || document.body;
							const clone = main.cloneNode(true);
							clone.querySelectorAll('nav, footer, script, style, header').forEach(el => el.remove());
							return clone.innerText?.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n') || '';
						});

						if (content.length > 100) {
							const title = await subPage.evaluate(() => document.title?.trim() || '');
							pages.push({ url, label, title, metaDesc: '', content });
							console.log(`    [ok] ${label} (${url}) — ${content.length.toLocaleString()} chars`);
						}
					} catch {
						// skip
					} finally {
						await subPage.close();
					}
					await delay(500);
				}
			}
		} finally {
			await page.close();
		}
	}

	return pages;
}

// --- Phase 2: Discover all event links from veent.io/discover ---

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

		const links = await page.$$eval('a[href]', (anchors) =>
			anchors.map((a) => a.href)
		);

		const eventLinks = [...new Set(
			links
				.filter((l) => /^https:\/\/[a-z0-9-]+\.veent\.net/.test(l))
				.map(normalizeUrl)
		)];

		return eventLinks;
	} finally {
		await page.close();
	}
}

// --- Extract structured data from a single event page ---

async function crawlEventPage(browser, url) {
	const page = await browser.newPage();
	try {
		await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

		const bodyText = await page.innerText('body');
		if (!bodyText || bodyText.length < 50) return null;

		const lines = bodyText.split('\n').map((l) => l.trim()).filter(Boolean);
		const fullText = lines.join('\n');

		// --- Event Name ---
		const eventName = await page.evaluate(() => {
			const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
			if (ogTitle && ogTitle.length > 2) return ogTitle;
			const title = document.title?.trim();
			if (title && title.length > 2) return title;
			const h1 = document.querySelector('h1')?.textContent?.trim();
			return h1 || '';
		}).catch(() => '') || '';

		if (!eventName) return null;

		// --- Date & Time: extract from SSR startTime/endTime meta ---
		const pageHtml = await page.content();
		const startTimeMatch = pageHtml.match(/startTime:"([^"]+)"/);
		const endTimeMatch = pageHtml.match(/endTime:"([^"]+)"/);

		let eventDate = '';
		let eventTime = '';
		let startDate = null;
		let monthKey = ''; // for grouping by month

		if (startTimeMatch) {
			startDate = new Date(startTimeMatch[1]);
			const dayName = DAY_NAMES[startDate.getUTCDay()];
			const month = MONTH_NAMES[startDate.getUTCMonth()];
			const day = startDate.getUTCDate();
			const year = startDate.getUTCFullYear();
			eventDate = `${dayName}, ${month} ${day}, ${year}`;
			monthKey = `${month.toLowerCase()}-${year}`;

			// Convert UTC to Asia/Manila (+8)
			const formatTime = (d) => {
				const h = (d.getUTCHours() + 8) % 24;
				const m = d.getUTCMinutes();
				const ampm = h >= 12 ? 'PM' : 'AM';
				const h12 = h % 12 || 12;
				return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
			};
			const startTimeStr = formatTime(startDate);
			if (endTimeMatch) {
				const endDate = new Date(endTimeMatch[1]);
				eventTime = `${startTimeStr} - ${formatTime(endDate)}`;
			} else {
				eventTime = startTimeStr;
			}
		} else {
			// Fallback: parse from visible text
			const fullDateMatch = fullText.match(
				/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\s+(\d{1,2})/i
			);
			const yearMatch = fullText.match(/\b(202[4-9])\b/);
			const year = yearMatch ? yearMatch[1] : '';

			if (fullDateMatch) {
				const dayName = fullDateMatch[1];
				const monthAbbr = fullDateMatch[2];
				const dayNum = fullDateMatch[3];
				const fullMonth = MONTH_ABBR_MAP[monthAbbr.toLowerCase().slice(0, 3)] || monthAbbr;
				eventDate = `${dayName}, ${fullMonth} ${dayNum}` + (year ? `, ${year}` : '');
				monthKey = `${fullMonth.toLowerCase()}-${year}`;
			}

			const timeMatch = fullText.match(
				/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i
			);
			eventTime = timeMatch ? `${timeMatch[1]} - ${timeMatch[2]}` : '';
		}

		// --- Skip past events if --upcoming-only flag set ---
		if (UPCOMING_ONLY && startDate && startDate.getTime() < Date.now()) {
			return null;
		}

		// --- Venue ---
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

		// --- Description ---
		const description = await page.$$eval('p', (els) => {
			const texts = els.map((p) => p.textContent?.trim() || '').filter((t) => t.length > 40);
			return texts.slice(0, 2).join(' ');
		}).catch(() => '');

		// --- Ticket Tiers ---
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

		// --- Build structured output ---
		let structured = `Event: ${eventName}\n`;
		structured += `Event Link: ${url}\n`;
		if (eventDate) structured += `Date: ${eventDate}\n`;
		if (eventTime) structured += `Time: ${eventTime}\n`;
		if (venue) structured += `Venue: ${venue}\n`;
		if (description) structured += `\nDescription: ${description}\n`;

		if (tiers.length > 0) {
			structured += `\nTicket Prices:\n`;
			for (const tier of tiers) {
				structured += `- ${tier.name}: ${tier.price}\n`;
			}
		}

		return { text: structured, monthKey, eventName, startDate };
	} catch (err) {
		console.warn(`  [error] ${url}: ${err.message}`);
		return null;
	} finally {
		await page.close();
	}
}

// --- Main ---

async function main() {
	if (!fs.existsSync(OUTPUT_DIR)) {
		fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	}

	console.log(`Mode: ${UPCOMING_ONLY ? 'upcoming only' : 'all events (past + upcoming)'}`);
	console.log(`Site crawl: ${EVENTS_ONLY ? 'skipped' : 'yes'}`);
	console.log(`Event crawl: ${SITE_ONLY ? 'skipped' : 'yes'}\n`);

	const browser = await chromium.launch();

	try {
		// === Phase 1: Main site pages ===
		if (!EVENTS_ONLY) {
			const sitePages = await crawlMainSite(browser);

			if (sitePages.length > 0) {
				// Build site info document
				let siteContent = '';
				for (const pg of sitePages) {
					siteContent += `## ${pg.title || pg.label}\n`;
					siteContent += `Source: ${pg.url}\n`;
					if (pg.metaDesc) siteContent += `${pg.metaDesc}\n`;
					siteContent += `\n${pg.content}\n\n---\n\n`;
				}

				const sitePath = path.join(OUTPUT_DIR, 'veent-site-info.md');
				fs.writeFileSync(sitePath, siteContent, 'utf-8');
				console.log(`\n  Wrote ${sitePath} — ${sitePages.length} pages, ${siteContent.length.toLocaleString()} chars`);

				// Warn if too large for a single Dify doc
				if (siteContent.length > 5000) {
					console.log(`  ⚠️  Site info is ${siteContent.length.toLocaleString()} chars — you may need to split into separate topic docs for Dify`);
				}
			} else {
				console.log('\n  No site pages found.');
			}
			console.log('');
		}

		// === Phase 2: Event pages ===
		if (!SITE_ONLY) {
			console.log('=== Phase 2: Crawling event pages ===\n');

			const eventLinks = await extractEventLinks(browser);
			console.log(`Found ${eventLinks.length} event pages\n`);

			const events = [];
			let count = 0;
			let skipped = 0;

			for (const eventUrl of eventLinks) {
				const result = await crawlEventPage(browser, eventUrl);
				if (result) {
					events.push(result);
					count++;
					const pastTag = result.startDate && result.startDate.getTime() < Date.now() ? ' (past)' : '';
					console.log(`  [${count}] ${result.eventName}${pastTag}`);
				} else {
					skipped++;
				}
				await delay(500);
			}

			console.log(`\nCrawled ${count} events (skipped ${skipped} empty/failed)\n`);

			if (events.length === 0) {
				console.log('No events found.');
				return;
			}

			// Group by month-year
			const byMonth = {};
			for (const event of events) {
				const key = event.monthKey || 'unknown';
				if (!byMonth[key]) byMonth[key] = [];
				byMonth[key].push(event);
			}

			// Sort events within each month by date
			for (const key of Object.keys(byMonth)) {
				byMonth[key].sort((a, b) => {
					if (a.startDate && b.startDate) return a.startDate.getTime() - b.startDate.getTime();
					return 0;
				});
			}

			// Write per-month files
			const monthFiles = [];
			const sortedMonths = Object.keys(byMonth).sort((a, b) => {
				const [aMonth, aYear] = a.split('-');
				const [bMonth, bYear] = b.split('-');
				if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
				return MONTH_NAMES.findIndex(m => m.toLowerCase() === aMonth) -
					MONTH_NAMES.findIndex(m => m.toLowerCase() === bMonth);
			});

			for (const monthKey of sortedMonths) {
				const monthEvents = byMonth[monthKey];
				const content = monthEvents.map((e) => e.text).join('\n---\n\n');

				const filename = `events-${monthKey}.md`;
				const filepath = path.join(OUTPUT_DIR, filename);
				fs.writeFileSync(filepath, content, 'utf-8');

				const charCount = content.length;
				monthFiles.push({ filename, events: monthEvents.length, chars: charCount });
			}

			// Write combined file for reference
			const allContent = events.map((e) => e.text).join('\n---\n\n');
			const allPath = path.join(OUTPUT_DIR, 'all-events.md');
			fs.writeFileSync(allPath, allContent, 'utf-8');

			// Summary
			const pastCount = events.filter(e => e.startDate && e.startDate.getTime() < Date.now()).length;
			const upcomingCount = events.length - pastCount;

			console.log(`--- Event Summary ---`);
			console.log(`Total: ${events.length} events (${upcomingCount} upcoming, ${pastCount} past)`);
			console.log(`Month files: ${monthFiles.length}`);
			for (const f of monthFiles) {
				const sizeWarning = f.chars > 5000 ? ' ⚠️  >5K chars, consider splitting' : '';
				console.log(`  ${f.filename}: ${f.events} events, ${f.chars.toLocaleString()} chars${sizeWarning}`);
			}
			console.log(`Combined: ${allPath} (${allContent.length.toLocaleString()} chars)`);
		}

		console.log(`\n--- Next Steps ---`);
		console.log(`  1. Review files in ${OUTPUT_DIR}/`);
		console.log(`  2. Split large files (>5K chars) if needed: npm run split`);
		console.log(`  3. Analyze before upload: npm run analyze -- tmp/<file>.md`);
		console.log(`  4. Upload to Dify one at a time with regression testing`);
	} finally {
		await browser.close();
	}
}

main().catch(console.error);
