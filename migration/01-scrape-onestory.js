/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * OneStory Website Scraper
 *
 * This script scrapes the OneStory website to extract:
 * - Language list
 * - Audio file URLs
 * - Story set metadata
 *
 * Usage: node 01-scrape-onestory.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ONESTORY_URL = 'https://www.onestory-media.org/';
const OUTPUT_DIR = './migration-data';

async function scrapeOneStory() {
  console.log('Starting OneStory scraper...');

  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // Navigate to OneStory website
    console.log(`Navigating to ${ONESTORY_URL}...`);
    await page.goto(ONESTORY_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Extract language list and links
    console.log('Extracting language list...');
    const languages = await page.evaluate(() => {
      const languageElements = document.querySelectorAll('ul li');
      const langs = [];

      languageElements.forEach((el) => {
        const text = el.textContent.trim();
        const link = el.querySelector('a');

        if (text && text.length > 0) {
          langs.push({
            name: text,
            url: link ? link.href : null,
          });
        }
      });

      return langs;
    });

    console.log(`Found ${languages.length} languages`);

    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Save language list
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'languages.json'),
      JSON.stringify(languages, null, 2)
    );

    console.log(`Saved language list to ${OUTPUT_DIR}/languages.json`);

    // Now we need to discover where the actual audio files are
    // Let's click on a few languages to see where they lead
    console.log('\nInvestigating audio file locations...');

    const sampleSize = Math.min(5, languages.length);
    const audioDiscovery = [];

    for (let i = 0; i < sampleSize; i++) {
      const lang = languages[i];
      if (!lang.url) continue;

      console.log(`Checking ${lang.name}...`);

      try {
        // Create new page for each language
        const langPage = await browser.newPage();

        // Set up request interception to capture audio URLs
        await langPage.setRequestInterception(true);
        const audioRequests = [];

        langPage.on('request', (request) => {
          const url = request.url();
          const resourceType = request.resourceType();

          if (
            resourceType === 'media' ||
            url.match(/\.(mp3|wav|m4a|ogg|aac)(\?|$)/i)
          ) {
            audioRequests.push({
              url: url,
              type: resourceType,
            });
          }

          request.continue();
        });

        // Navigate to language page
        await langPage
          .goto(lang.url, {
            waitUntil: 'networkidle2',
            timeout: 30000,
          })
          .catch((err) => {
            console.log(`  Could not load page: ${err.message}`);
          });

        // Wait a bit for any dynamic content
        await delay(2000);

        // Look for audio players or download links
        const pageInfo = await langPage.evaluate(() => {
          const audioElements = document.querySelectorAll('audio');
          const audioTags = Array.from(audioElements).map((a) => ({
            src: a.src,
            sources: Array.from(a.querySelectorAll('source')).map((s) => s.src),
          }));

          const links = Array.from(document.querySelectorAll('a'))
            .filter((a) => {
              const href = a.href.toLowerCase();
              return href.match(/\.(mp3|wav|m4a|ogg|aac)(\?|$)/i);
            })
            .map((a) => ({
              text: a.textContent.trim(),
              href: a.href,
            }));

          return {
            audioTags,
            downloadLinks: links,
            pageTitle: document.title,
            pageUrl: window.location.href,
          };
        });

        audioDiscovery.push({
          language: lang.name,
          url: lang.url,
          audioRequests,
          pageInfo,
        });

        console.log(
          `  Found ${audioRequests.length} audio requests, ${pageInfo.audioTags.length} audio tags, ${pageInfo.downloadLinks.length} download links`
        );

        await langPage.close();

        // Be respectful - add delay between requests
        await delay(1000);
      } catch (error) {
        console.error(`  Error processing ${lang.name}: ${error.message}`);
      }
    }

    // Save audio discovery results
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'audio-discovery.json'),
      JSON.stringify(audioDiscovery, null, 2)
    );

    console.log(
      `\nSaved audio discovery to ${OUTPUT_DIR}/audio-discovery.json`
    );

    // Generate summary report
    const summary = {
      scrapedAt: new Date().toISOString(),
      totalLanguages: languages.length,
      sampleSize: audioDiscovery.length,
      findings: {
        languagesWithUrls: languages.filter((l) => l.url).length,
        audioDiscovery: audioDiscovery.map((d) => ({
          language: d.language,
          hasAudio:
            d.audioRequests.length > 0 ||
            d.pageInfo.audioTags.length > 0 ||
            d.pageInfo.downloadLinks.length > 0,
          audioCount:
            d.audioRequests.length +
            d.pageInfo.audioTags.length +
            d.pageInfo.downloadLinks.length,
        })),
      },
    };

    await fs.writeFile(
      path.join(OUTPUT_DIR, 'scrape-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('\n=== SCRAPE COMPLETE ===');
    console.log(`Total languages: ${summary.totalLanguages}`);
    console.log(`Sample checked: ${summary.sampleSize}`);
    console.log('\nNext steps:');
    console.log('1. Review the files in ./migration-data/');
    console.log(
      '2. Check audio-discovery.json to understand the audio file structure'
    );
    console.log(
      '3. Update the scraper if needed to fully download all audio files'
    );
    console.log('4. Run 02-download-audio.js to download all audio files');
  } catch (error) {
    console.error('Error during scraping:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the scraper
scrapeOneStory().catch(console.error);
