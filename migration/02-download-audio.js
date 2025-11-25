/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * OneStory Audio Downloader
 *
 * This script downloads all audio files from the OneStory website
 * based on the data extracted by the scraper.
 *
 * Usage: node 02-download-audio.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function acceptCookies(page) {
  const selectors = [
    '#onetrust-accept-btn-handler',
    'button[data-testid="uc-accept-all-button"]',
    'button[data-test="polar:accept-all"]',
    'button[mode="primary"]',
    'button.cookie-consent-accept',
    'button.cc-allow',
    'button#cookie-consent-accept',
    'button[aria-label*="accept"]',
  ];

  try {
    for (const selector of selectors) {
      const button = await page.$(selector);
      if (button) {
        await button.click();
        await delay(500);
        return true;
      }
    }

    const clickedFallback = await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll('button, [role="button"]')
      );
      const acceptRegex = /(accept|agree|ok|understand)/i;
      const rejectRegex = /(reject|decline)/i;

      const button = candidates.find((el) => {
        const text = (el.textContent || '').trim();
        if (!text || rejectRegex.test(text)) {
          return false;
        }
        if (acceptRegex.test(text)) {
          return true;
        }
        const label = (el.getAttribute('aria-label') || '').trim();
        return label && acceptRegex.test(label);
      });

      if (button) {
        button.click();
        return true;
      }

      return false;
    });

    if (clickedFallback) {
      await delay(500);
      return true;
    }
  } catch (error) {
    console.warn(`  Cookie banner handling failed: ${error.message}`);
  }

  return false;
}

const INPUT_FILE = './migration-data/languages.json';
const OUTPUT_DIR = './migration-data/audio';
const METADATA_FILE = './migration-data/audio-metadata.json';

async function resolveLanguageId(langUrl, depth = 0) {
  if (depth > 5) {
    return null;
  }

  try {
    const target = new URL(langUrl);
    const protocol = target.protocol === 'https:' ? https : http;

    return await new Promise((resolve) => {
      const request = protocol.request(
        {
          hostname: target.hostname,
          path: target.pathname + (target.search || ''),
          method: 'GET',
        },
        (response) => {
          const setCookie = response.headers['set-cookie'] || [];
          for (const cookie of setCookie) {
            const match = cookie.match(/language_id=(\d+)/);
            if (match) {
              response.resume();
              resolve(match[1]);
              return;
            }
          }

          if (
            response.statusCode &&
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            response.resume();
            const nextUrl = new URL(response.headers.location, target);
            resolve(resolveLanguageId(nextUrl.toString(), depth + 1));
            return;
          }

          response.resume();
          resolve(null);
        }
      );

      request.on('error', () => resolve(null));
      request.end();
    });
  } catch (error) {
    console.warn(
      `  Failed to resolve language cookie for ${langUrl}: ${error.message}`
    );
    return null;
  }
}

async function fetchLanguagePage(langUrl, languageId, pageNumber) {
  try {
    const target = new URL(langUrl);
    const protocol = target.protocol === 'https:' ? https : http;
    const path = `/story_sets/?page=${pageNumber}`;

    return await new Promise((resolve) => {
      const request = protocol.request(
        {
          hostname: target.hostname,
          path,
          method: 'GET',
          headers: {
            Cookie: `language_id=${languageId}`,
          },
        },
        (response) => {
          if (response.statusCode !== 200) {
            response.resume();
            resolve(null);
            return;
          }

          let data = '';
          response.on('data', (chunk) => {
            data += chunk.toString();
          });

          response.on('end', () => resolve(data));
        }
      );

      request.on('error', () => resolve(null));
      request.end();
    });
  } catch (error) {
    console.warn(
      `  Failed to fetch page ${pageNumber} for ${langUrl}: ${error.message}`
    );
    return null;
  }
}

async function collectAudioEntries(page, html) {
  return page.evaluate(
    (payload) => {
      const { html } = payload || {};
      let root = document;
      let wrapper = null;

      if (html) {
        wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper);
        root = wrapper;
      }

      const results = [];

      root.querySelectorAll('audio').forEach((audio, idx) => {
        const src = audio.src || audio.querySelector('source')?.src;
        if (src) {
          results.push({
            type: 'audio-element',
            url: src,
            title:
              audio.title ||
              audio.getAttribute('aria-label') ||
              `Audio ${idx + 1}`,
          });
        }
      });

      root.querySelectorAll('a').forEach((link, idx) => {
        const href = link.href;
        if (href && href.match(/\.(mp3|wav|m4a|ogg|aac)(\?|$)/i)) {
          const deriveTitle = () => {
            try {
              const rawName = href.split('/').pop() || '';
              const withoutQuery = rawName.split('?')[0];
              const decoded = decodeURIComponent(withoutQuery);
              const withoutExtension = decoded.replace(/\.[^.]+$/, '');
              const normalized = withoutExtension
                .replace(/_/g, ' ')
                .replace(/\s+OneStory.*$/i, '')
                .trim();
              return normalized;
            } catch {
              return '';
            }
          };

          const defaultTitle = deriveTitle();

          results.push({
            type: 'download-link',
            url: href,
            title:
              defaultTitle ||
              link.textContent.trim() ||
              link.title ||
              `Download ${idx + 1}`,
          });
        }
      });

      const hasNext = !!(
        root.querySelector('li.link-next a') ||
        root.querySelector('a.link-next')
      );

      if (wrapper) {
        wrapper.remove();
      }

      return { entries: results, hasNext };
    },
    { html }
  );
}

async function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = require('fs').createWriteStream(filepath);

    protocol
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          file.close();
          downloadFile(response.headers.location, filepath)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', (err) => {
        file.close();
        reject(err);
      });
  });
}

async function downloadAudioFiles() {
  console.log('Starting audio download...');

  // Read language list
  const languagesRaw = await fs.readFile(INPUT_FILE, 'utf-8');
  const languages = JSON.parse(languagesRaw);

  console.log(`Found ${languages.length} languages to process`);

  // Create output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const audioMetadata = [];
  let totalDownloaded = 0;

  const MaxLanguages = 120;

  try {
    for (let i = 0; i < Math.min(languages.length, MaxLanguages); i++) {
      const lang = languages[i];
      console.log(
        `\n[${i + 1}/${languages.length}] Processing ${lang.name}...`
      );

      if (!lang.url) {
        console.log('  No URL available, skipping...');
        continue;
      }

      try {
        const languageId = await resolveLanguageId(lang.url);
        const page = await browser.newPage();

        if (languageId) {
          console.log(`  Using language cookie id ${languageId}`);
          await page.setExtraHTTPHeaders({
            Cookie: `language_id=${languageId}`,
          });
        }

        // Track all media requests
        const mediaUrls = new Set();

        await page.setRequestInterception(true);
        page.on('request', (request) => {
          const url = request.url();
          const resourceType = request.resourceType();

          if (
            resourceType === 'media' ||
            url.match(/\.(mp3|wav|m4a|ogg|aac)(\?|$)/i)
          ) {
            mediaUrls.add(url);
          }

          if (languageId) {
            const headers = {
              ...request.headers(),
            };

            const existingCookie = headers.cookie || '';
            const cookieParts = existingCookie
              .split(';')
              .map((part) => part.trim())
              .filter(Boolean)
              .filter((part) => !part.toLowerCase().startsWith('language_id='));

            cookieParts.push(`language_id=${languageId}`);
            headers.cookie = cookieParts.join('; ');

            request.continue({ headers });
            return;
          }

          request.continue();
        });

        // Navigate to language page
        await page.goto(lang.url, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });

        await acceptCookies(page);
        await delay(2000);

        const aggregatedAudioInfo = [];
        const firstPageData = await collectAudioEntries(page);
        aggregatedAudioInfo.push(...firstPageData.entries);

        if (firstPageData.hasNext) {
          if (languageId) {
            let pageNumber = 2;
            while (true) {
              await delay(500);
              const html = await fetchLanguagePage(
                lang.url,
                languageId,
                pageNumber
              );

              if (!html) {
                break;
              }

              const pageData = await collectAudioEntries(page, html);
              aggregatedAudioInfo.push(...pageData.entries);

              if (!pageData.hasNext) {
                break;
              }

              pageNumber += 1;
            }
          } else {
            console.warn(
              '  Could not resolve language cookie; skipping additional pages.'
            );
          }
        }

        // Combine all discovered URLs
        const allAudioUrls = [
          ...aggregatedAudioInfo.map((a) => ({ url: a.url, title: a.title })),
          ...Array.from(mediaUrls).map((url) => ({
            url,
            title: path.basename(url),
          })),
        ];

        // Remove duplicates
        const uniqueAudio = Array.from(
          new Map(allAudioUrls.map((item) => [item.url, item])).values()
        );

        console.log(`  Found ${uniqueAudio.length} audio files`);

        // Download each audio file
        const langDir = path.join(
          OUTPUT_DIR,
          lang.name.replace(/[^a-z0-9]/gi, '_')
        );
        await fs.mkdir(langDir, { recursive: true });

        for (let j = 0; j < uniqueAudio.length; j++) {
          const audio = uniqueAudio[j];
          const ext = path.extname(audio.url).split('?')[0] || '.mp3';
          const filename = `${j + 1}_${audio.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}${ext}`;
          const filepath = path.join(langDir, filename);

          try {
            console.log(`    Downloading: ${audio.title}...`);
            await downloadFile(audio.url, filepath);

            const stats = await fs.stat(filepath);

            audioMetadata.push({
              language: lang.name,
              title: audio.title,
              url: audio.url,
              filepath: filepath,
              filesize: stats.size,
              downloadedAt: new Date().toISOString(),
            });

            totalDownloaded++;
          } catch (err) {
            console.error(`    Failed to download: ${err.message}`);
          }
        }

        await page.close();

        // Be respectful - add delay between languages
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`  Error processing ${lang.name}: ${error.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  // Save metadata
  await fs.writeFile(METADATA_FILE, JSON.stringify(audioMetadata, null, 2));

  console.log('\n=== DOWNLOAD COMPLETE ===');
  console.log(`Total files downloaded: ${totalDownloaded}`);
  console.log(`Metadata saved to: ${METADATA_FILE}`);
  console.log(
    '\nNext step: Run 03-transform-to-ptf.js to convert to APM format'
  );
}

downloadAudioFiles().catch(console.error);
