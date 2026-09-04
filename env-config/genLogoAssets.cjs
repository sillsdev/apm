/**
 * Regenerate every app logo asset from the single brand source,
 * src/renderer/src/assets/apm-logo.svg.
 *
 *   node env-config/genLogoAssets.cjs
 *
 * Rasterizing needs a Chrome/Chromium. The script uses the one puppeteer
 * downloaded; set PUPPETEER_EXECUTABLE_PATH to point at another (e.g. an
 * installed Google Chrome) when that download is missing or broken.
 *
 * Outputs are committed, so this only needs re-running when the logo changes.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const SOURCE = path.join(root, 'src/renderer/src/assets/apm-logo.svg');

// Measured from the source artwork: the mark is centred in the 1000x1000
// viewBox and spans 860.34 units, so it carries ~7% padding of its own.
const ART = { x: 69.83, y: 69.83, size: 860.34 };
const VIEWBOX = 1000;

// The mark is not a disc: the A's legs splay past the ring, so its furthest
// point from centre sits 1.052x beyond the edge of its own bounding box.
// Maskable sizing has to work from this, not from the box or the ring.
const REACH_OVER_HALF_BOX = 1.052;

// Android crops maskable icons to an arbitrary shape and guarantees only a
// circle of 80% diameter. Keep the furthest ink at 76% of the radius.
const MASKABLE_REACH_TARGET = 0.76;

const WHITE = '#FFFFFF';

/** The mark cropped to its own bounds — no built-in padding. */
const cropped = (svg) =>
  svg.replace(
    /viewBox="0 0 1000 1000"\s+width="1000"\s+height="1000"/,
    `viewBox="${ART.x} ${ART.y} ${ART.size} ${ART.size}"`
  );

/**
 * Every raster we ship. `pad` is the artwork box as a fraction of the icon
 * edge; `bg` opaque fills the whole canvas (transparent when null).
 */
const TARGETS = [
  // Full-bleed favicon frames: at 16px every spare pixel counts, so the mark's
  // own padding is cropped away rather than shrinking it further.
  {
    sizes: [16, 32, 48, 64],
    pad: 1,
    bg: null,
    ico: true,
    // favicon.ico is read from three places: the web root, the Electron auth
    // window, and the packaged resources.
    icoOutputs: [
      'src/renderer/public/favicon.ico',
      'src/renderer/favicon.ico',
      'resources/favicon.ico',
    ],
  },

  // The Windows app/installer icon. Pre-generated and committed rather than
  // left for electron-builder to derive from resources/icon.png at build
  // time: that derivation shells out to a tool it downloads from GitHub on
  // every build, which is one more thing that can go wrong (or differ) on a
  // given build agent. Rendered directly from the vector source per size,
  // same as the favicon, rather than downscaled from a raster.
  {
    sizes: [16, 24, 32, 48, 64, 128, 256],
    pad: ART.size / VIEWBOX,
    bg: null,
    ico: true,
    icoOutputs: ['resources/icon.ico'],
  },

  // iOS draws its own rounded-rect mask and never adds padding, and it
  // composites any alpha over black — so this one must be opaque.
  {
    out: 'src/renderer/public/apple-touch-icon.png',
    sizes: [180],
    pad: ART.size / VIEWBOX,
    bg: WHITE,
  },

  {
    out: 'src/renderer/public/pwa-192x192.png',
    sizes: [192],
    pad: ART.size / VIEWBOX,
    bg: null,
  },
  {
    out: 'src/renderer/public/pwa-512x512.png',
    sizes: [512],
    pad: ART.size / VIEWBOX,
    bg: null,
  },
  {
    out: 'src/renderer/public/pwa-maskable-512x512.png',
    sizes: [512],
    // Shrink until the outermost ink lands inside the safe circle, and fill
    // the rest with the plate colour so the crop has something to bite on.
    pad: MASKABLE_REACH_TARGET / REACH_OVER_HALF_BOX,
    bg: WHITE,
  },

  // electron-builder derives macOS's .icns from this (and it's the mac build
  // icon directly); 1024 gives it a real retina source instead of upscaling
  // 512. Windows uses the pre-generated resources/icon.ico above instead.
  {
    out: 'resources/icon.png',
    sizes: [1024],
    pad: ART.size / VIEWBOX,
    bg: null,
  },
  {
    out: 'debian/audio-project-manager.png',
    sizes: [512],
    pad: ART.size / VIEWBOX,
    bg: null,
  },
];

/** Pack PNG buffers into an ICO. PNG-compressed entries are read by every
 *  browser and by Windows Vista and later. */
function buildIco(entries) {
  const dir = Buffer.alloc(6 + entries.length * 16);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // type: icon
  dir.writeUInt16LE(entries.length, 4);

  let offset = dir.length;
  entries.forEach(({ size, png }, i) => {
    const o = 6 + i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o); // 0 means 256
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2); // palette colours
    dir.writeUInt8(0, o + 3); // reserved
    dir.writeUInt16LE(1, o + 4); // colour planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });

  return Buffer.concat([dir, ...entries.map((e) => e.png)]);
}

/** Drop PNG chunks that carry no pixels (timestamps, colour-profile hints). */
function stripPngMetadata(png) {
  const KEEP = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);
  const out = [png.subarray(0, 8)]; // signature
  const idat = [];
  let p = 8;
  let ihdr = null;

  while (p < png.length) {
    const len = png.readUInt32BE(p);
    const type = png.toString('ascii', p + 4, p + 8);
    const chunk = png.subarray(p, p + 12 + len);
    if (type === 'IHDR') ihdr = chunk;
    else if (type === 'IDAT') idat.push(png.subarray(p + 8, p + 8 + len));
    else if (KEEP.has(type) && type !== 'IEND') out.push(chunk);
    p += 12 + len;
  }
  if (!ihdr || !idat.length) return png;

  // Recompress the concatenated image data at maximum effort.
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const deflated = zlib.deflateSync(raw, { level: 9, memLevel: 9 });
  const recompressed =
    deflated.length < Buffer.concat(idat).length
      ? deflated
      : Buffer.concat(idat);

  const chunk = (type, data) => {
    const b = Buffer.alloc(12 + data.length);
    b.writeUInt32BE(data.length, 0);
    b.write(type, 4, 'ascii');
    data.copy(b, 8);
    b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length);
    return b;
  };

  return Buffer.concat([
    out[0],
    ihdr,
    ...out.slice(1),
    chunk('IDAT', recompressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++)
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

async function main() {
  const svg = fs.readFileSync(SOURCE, 'utf8');
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(cropped(svg)).toString('base64')}`;

  const browser = await puppeteer.launch({
    headless: true,
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
  });
  const page = await browser.newPage();

  /** Render the mark at `size` px, scaled to `pad` of the canvas. */
  const render = async (size, pad, bg) => {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(
      `<style>
         html,body{margin:0;padding:0;background:${bg ?? 'transparent'}}
         body{width:${size}px;height:${size}px;display:grid;place-items:center}
         img{width:${size * pad}px;height:${size * pad}px;display:block}
       </style>
       <img src="${dataUri}">`,
      { waitUntil: 'load' }
    );
    // Newer puppeteer hands back a Uint8Array, not a Buffer.
    const shot = await page.screenshot({ type: 'png', omitBackground: !bg });
    return stripPngMetadata(Buffer.from(shot));
  };

  const written = [];
  for (const target of TARGETS) {
    const rendered = [];
    for (const size of target.sizes) {
      rendered.push({ size, png: await render(size, target.pad, target.bg) });
    }

    if (target.ico) {
      const ico = buildIco(rendered);
      for (const out of target.icoOutputs) {
        fs.writeFileSync(path.join(root, out), ico);
        written.push([out, ico.length]);
      }
    } else {
      fs.writeFileSync(path.join(root, target.out), rendered[0].png);
      written.push([target.out, rendered[0].png.length]);
    }
  }

  // A vector favicon: browsers that support it get a mark that stays sharp at
  // any size and in any pixel density, and never touch the .ico.
  const faviconSvg = path.join(root, 'src/renderer/public/favicon.svg');
  fs.writeFileSync(faviconSvg, cropped(svg));
  written.push([
    'src/renderer/public/favicon.svg',
    fs.statSync(faviconSvg).size,
  ]);

  await browser.close();

  const pad = Math.max(...written.map(([f]) => f.length));
  for (const [file, bytes] of written) {
    console.log(`${file.padEnd(pad)}  ${(bytes / 1024).toFixed(1)} KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
