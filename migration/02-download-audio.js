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

const INPUT_FILE = './migration-data/languages.json';
const OUTPUT_DIR = './migration-data/audio';
const METADATA_FILE = './migration-data/audio-metadata.json';

async function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = require('fs').createWriteStream(filepath);

    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        file.close();
        downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
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
    }).on('error', (err) => {
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
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const audioMetadata = [];
  let totalDownloaded = 0;

  try {
    for (let i = 0; i < languages.length; i++) {
      const lang = languages[i];
      console.log(`\n[${i + 1}/${languages.length}] Processing ${lang.name}...`);

      if (!lang.url) {
        console.log('  No URL available, skipping...');
        continue;
      }

      try {
        const page = await browser.newPage();

        // Track all media requests
        const mediaUrls = new Set();

        await page.setRequestInterception(true);
        page.on('request', request => {
          const url = request.url();
          const resourceType = request.resourceType();

          if (resourceType === 'media' || url.match(/\.(mp3|wav|m4a|ogg|aac)(\?|$)/i)) {
            mediaUrls.add(url);
          }

          request.continue();
        });

        // Navigate to language page
        await page.goto(lang.url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for dynamic content
        await page.waitForTimeout(2000);

        // Extract audio elements and download links
        const audioInfo = await page.evaluate(() => {
          const results = [];

          // Find audio elements
          document.querySelectorAll('audio').forEach((audio, idx) => {
            const src = audio.src || audio.querySelector('source')?.src;
            if (src) {
              results.push({
                type: 'audio-element',
                url: src,
                title: audio.title || audio.getAttribute('aria-label') || `Audio ${idx + 1}`
              });
            }
          });

          // Find download links
          document.querySelectorAll('a').forEach(link => {
            const href = link.href;
            if (href && href.match(/\.(mp3|wav|m4a|ogg|aac)(\?|$)/i)) {
              results.push({
                type: 'download-link',
                url: href,
                title: link.textContent.trim() || link.title || path.basename(href)
              });
            }
          });

          return results;
        });

        // Combine all discovered URLs
        const allAudioUrls = [
          ...audioInfo.map(a => ({ url: a.url, title: a.title })),
          ...Array.from(mediaUrls).map(url => ({ url, title: path.basename(url) }))
        ];

        // Remove duplicates
        const uniqueAudio = Array.from(
          new Map(allAudioUrls.map(item => [item.url, item])).values()
        );

        console.log(`  Found ${uniqueAudio.length} audio files`);

        // Download each audio file
        const langDir = path.join(OUTPUT_DIR, lang.name.replace(/[^a-z0-9]/gi, '_'));
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
              downloadedAt: new Date().toISOString()
            });

            totalDownloaded++;

          } catch (err) {
            console.error(`    Failed to download: ${err.message}`);
          }
        }

        await page.close();

        // Be respectful - add delay between languages
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`  Error processing ${lang.name}: ${error.message}`);
      }
    }

  } finally {
    await browser.close();
  }

  // Save metadata
  await fs.writeFile(
    METADATA_FILE,
    JSON.stringify(audioMetadata, null, 2)
  );

  console.log('\n=== DOWNLOAD COMPLETE ===');
  console.log(`Total files downloaded: ${totalDownloaded}`);
  console.log(`Metadata saved to: ${METADATA_FILE}`);
  console.log('\nNext step: Run 03-transform-to-ptf.js to convert to APM format');
}

downloadAudioFiles().catch(console.error);

