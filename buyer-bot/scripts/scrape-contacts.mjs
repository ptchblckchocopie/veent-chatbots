/**
 * Scrape Organizer Contact Info for Upcoming Events
 *
 * Reads event markdown files from knowledge-base/, visits each upcoming event page,
 * scrapes the "NEED HELP? CONTACT US" section, and updates the markdown with
 * Organizer Contact info.
 *
 * Usage:
 *   npm run scrape:contacts              # scrape contacts for upcoming events
 *   npm run scrape:contacts -- --dry-run # preview changes without writing files
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const KB_DIR = 'knowledge-base';
const DRY_RUN = process.argv.includes('--dry-run');

const MONTH_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
];

function parseDate(dateStr) {
	// Parse "Saturday, March 7, 2026" or "March 7, 2026"
	const match = dateStr.match(
		/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/
	);
	if (!match) return null;
	const monthMatch = dateStr.match(
		/(January|February|March|April|May|June|July|August|September|October|November|December)/
	);
	if (!monthMatch) return null;
	const monthIdx = MONTH_NAMES.indexOf(monthMatch[1]);
	return new Date(parseInt(match[2]), monthIdx, parseInt(match[1]));
}

function parseEventsFromFile(filepath) {
	const content = fs.readFileSync(filepath, 'utf-8');
	const lines = content.split('\n');
	const events = [];
	let currentEvent = null;
	let headerLines = [];
	let inHeader = true;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (line.startsWith('Event:') && !line.startsWith('Event Link:')) {
			if (inHeader) {
				headerLines = lines.slice(0, i);
				inHeader = false;
			}
			if (currentEvent) {
				currentEvent.endLine = i - 1;
				events.push(currentEvent);
			}
			currentEvent = {
				name: line.replace('Event:', '').trim(),
				startLine: i,
				endLine: null,
				link: null,
				date: null,
				parsedDate: null,
				hasContact: false,
			};
		}

		if (currentEvent) {
			if (line.startsWith('Event Link:')) {
				currentEvent.link = line.replace('Event Link:', '').trim();
			}
			if (line.startsWith('Date:')) {
				currentEvent.date = line.replace('Date:', '').trim();
				currentEvent.parsedDate = parseDate(currentEvent.date);
			}
			if (line.match(/Organizer Contact:/i)) {
				currentEvent.hasContact = true;
			}
		}
	}

	if (currentEvent) {
		currentEvent.endLine = lines.length - 1;
		events.push(currentEvent);
	}

	return { lines, events, headerLines };
}

async function scrapeContact(browser, url) {
	const page = await browser.newPage();
	try {
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
		await page.waitForTimeout(2000);

		const contact = await page.evaluate(() => {
			const body = document.body.innerText || '';

			// Look for "NEED HELP? CONTACT US" section
			const contactIdx = body.indexOf('NEED HELP?');
			if (contactIdx === -1) return null;

			const contactSection = body.substring(contactIdx, contactIdx + 500);
			const sectionLines = contactSection.split('\n').map(l => l.trim()).filter(Boolean);

			// The organizer name and contact are typically the lines after "CONTACT US"
			let orgName = null;
			let contactInfo = null;

			for (const line of sectionLines) {
				// Skip header lines
				if (/NEED HELP|CONTACT US/i.test(line)) continue;
				// Skip "Hosted by" or "Powered by"
				if (/Hosted by|Powered by|Verify QR/i.test(line)) continue;

				if (!orgName) {
					orgName = line;
					continue;
				}
				if (!contactInfo) {
					contactInfo = line;
					break;
				}
			}

			if (!orgName) return null;
			return { orgName, contactInfo };
		});

		if (!contact) {
			// Also try extracting from links in the contact section
			const linkContact = await page.evaluate(() => {
				const allText = document.body.innerText || '';
				const contactIdx = allText.indexOf('NEED HELP?');
				if (contactIdx === -1) return null;

				// Find the contact section element
				const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, div, p, span'));
				const contactHeading = headings.find(el =>
					el.textContent?.includes('NEED HELP') || el.textContent?.includes('CONTACT US')
				);
				if (!contactHeading) return null;

				// Look for the nearest parent section
				let section = contactHeading.closest('section') ||
					contactHeading.closest('div[class*="contact"]') ||
					contactHeading.parentElement?.parentElement;
				if (!section) return null;

				// Find links in the section
				const links = section.querySelectorAll('a[href]');
				const contactLinks = Array.from(links).filter(a => {
					const href = a.href || '';
					return href.includes('facebook.com') ||
						href.includes('instagram.com') ||
						href.includes('twitter.com') ||
						href.includes('mailto:') ||
						href.includes('tel:');
				});

				// Find organizer name - look for text that's not a link and not a heading
				const textNodes = section.querySelectorAll('p, span, div');
				let orgName = null;
				for (const node of textNodes) {
					const text = node.textContent?.trim();
					if (!text || text.length < 2 || text.length > 100) continue;
					if (/NEED HELP|CONTACT US|Hosted by|Powered by/i.test(text)) continue;
					if (node.querySelector('a')) continue;
					// Direct text content (not from children)
					const directText = Array.from(node.childNodes)
						.filter(n => n.nodeType === 3)
						.map(n => n.textContent?.trim())
						.filter(Boolean)
						.join(' ');
					if (directText && directText.length > 1 && directText.length < 100) {
						orgName = directText;
						break;
					}
				}

				if (!orgName) {
					// Try getting text before the first link
					for (const node of textNodes) {
						const text = node.textContent?.trim();
						if (!text || text.length < 2) continue;
						if (/NEED HELP|CONTACT US|Hosted by|Powered by/i.test(text)) continue;
						orgName = text.split('\n')[0]?.trim();
						if (orgName && orgName.length > 1) break;
					}
				}

				if (contactLinks.length > 0) {
					const link = contactLinks[0];
					const href = link.href;
					return {
						orgName: orgName || link.textContent?.trim() || 'Unknown',
						contactInfo: href
					};
				}

				// Check for phone numbers
				const phoneMatch = section.textContent?.match(/(0\d{10}|\+63\d{10})/);
				if (phoneMatch) {
					return {
						orgName: orgName || 'Organizer',
						contactInfo: phoneMatch[1]
					};
				}

				return orgName ? { orgName, contactInfo: null } : null;
			});

			return linkContact;
		}

		return contact;
	} catch (err) {
		console.log(`  [error] ${url}: ${err.message}`);
		return null;
	} finally {
		await page.close();
	}
}

function formatContact(contact) {
	if (!contact) return null;

	let line = `  Organizer Contact: ${contact.orgName}`;
	if (contact.contactInfo) {
		if (contact.contactInfo.includes('facebook.com')) {
			line += ` — Facebook: ${contact.contactInfo}`;
		} else if (contact.contactInfo.includes('instagram.com')) {
			line += ` — Instagram: ${contact.contactInfo}`;
		} else if (contact.contactInfo.includes('mailto:')) {
			line += ` — Email: ${contact.contactInfo.replace('mailto:', '')}`;
		} else if (contact.contactInfo.includes('tel:')) {
			line += ` — Phone: ${contact.contactInfo.replace('tel:', '')}`;
		} else if (/^0\d{10}$|^\+63/.test(contact.contactInfo)) {
			line += ` — Phone: ${contact.contactInfo}`;
		} else {
			line += ` — ${contact.contactInfo}`;
		}
	}
	return line;
}

async function main() {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	console.log(`Scraping organizer contacts for upcoming events (from ${today.toDateString()})`);
	if (DRY_RUN) console.log('DRY RUN - no files will be modified\n');
	else console.log('');

	// Find event markdown files
	const files = fs.readdirSync(KB_DIR)
		.filter(f => f.startsWith('events-') && f.endsWith('.md'))
		.map(f => path.join(KB_DIR, f));

	if (files.length === 0) {
		console.log('No event files found in knowledge-base/');
		return;
	}

	// Parse all events and filter upcoming ones without contact info
	const toScrape = [];
	const fileData = {};

	for (const filepath of files) {
		const parsed = parseEventsFromFile(filepath);
		fileData[filepath] = parsed;

		for (const event of parsed.events) {
			if (!event.link) continue;
			if (event.hasContact) {
				console.log(`  [skip] ${event.name} — already has contact info`);
				continue;
			}
			if (event.parsedDate && event.parsedDate < today) {
				continue; // silently skip past events
			}
			toScrape.push({ ...event, filepath });
		}
	}

	console.log(`\nFound ${toScrape.length} upcoming events without contact info\n`);

	if (toScrape.length === 0) {
		console.log('Nothing to scrape.');
		return;
	}

	const browser = await chromium.launch();
	const results = new Map(); // filepath -> [{event, contactLine}]

	try {
		let scraped = 0;
		let found = 0;
		let notFound = 0;

		for (const event of toScrape) {
			scraped++;
			process.stdout.write(`  [${scraped}/${toScrape.length}] ${event.name}... `);

			const contact = await scrapeContact(browser, event.link);
			const contactLine = formatContact(contact);

			if (contactLine) {
				found++;
				console.log(`found: ${contact.orgName}`);
				if (!results.has(event.filepath)) results.set(event.filepath, []);
				results.get(event.filepath).push({ event, contactLine });
			} else {
				notFound++;
				console.log('no contact section');
			}

			// Small delay between requests
			await new Promise(r => setTimeout(r, 300));
		}

		console.log(`\n--- Results ---`);
		console.log(`Scraped: ${scraped} | Found: ${found} | No contact: ${notFound}\n`);

		// Update files
		for (const [filepath, updates] of results) {
			const parsed = fileData[filepath];
			const lines = [...parsed.lines];

			// Apply updates in reverse order (to not shift line numbers)
			const sortedUpdates = updates.sort((a, b) => b.event.endLine - a.event.endLine);

			for (const { event, contactLine } of sortedUpdates) {
				// Find the insertion point: after the last non-empty line of the event block
				let insertAt = event.endLine;

				// Walk backward from endLine to find the last content line
				while (insertAt > event.startLine && lines[insertAt].trim() === '') {
					insertAt--;
				}

				// Insert contact line after the last content line
				lines.splice(insertAt + 1, 0, contactLine);
			}

			const newContent = lines.join('\n');

			if (DRY_RUN) {
				console.log(`[dry-run] Would update ${filepath}:`);
				for (const { event, contactLine } of updates) {
					console.log(`  ${event.name}: ${contactLine.trim()}`);
				}
			} else {
				fs.writeFileSync(filepath, newContent, 'utf-8');
				console.log(`Updated ${filepath} (${updates.length} contacts added)`);
			}
		}
	} finally {
		await browser.close();
	}

	console.log('\nDone!');
	if (!DRY_RUN && results.size > 0) {
		console.log('\nNext steps:');
		console.log('  1. Review changes: git diff knowledge-base/');
		console.log('  2. Run baseline capture before uploading: npm run baseline:capture');
		console.log('  3. Upload updated docs to Dify: npm run upload');
		console.log('  4. Run baseline compare after upload: npm run baseline:compare');
	}
}

main().catch(console.error);
