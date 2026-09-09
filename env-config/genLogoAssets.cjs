/**
 * Regenerate every app logo asset from src/renderer/src/assets/apm-logo.svg
 *
 * Rasterizing needs a Chrome/Chromium. The script uses the one puppeteer
 * downloaded; set PUPPETEER_EXECUTABLE_PATH to point at another (e.g. an
 * installed Google Chrome) when that download is missing or broken.
 *
 * Outputs are committed, so this only needs re-running when the logo changes.
 */

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

// favicon.ico is read from three places: the web root, the Electron auth
// window, and the packaged resources.
const FAVICON_ICO = [
  'src/renderer/public/favicon.ico',
  'src/renderer/favicon.ico',
  'resources/favicon.ico',
];

// The Windows app icon, referenced by `build.win.icon` in package.json.
const WINDOWS_ICO = ['resources/icon.ico'];

/**
 * Every raster we ship. `pad` is the artwork box as a fraction of the icon
 * edge; `bg` opaque fills the whole canvas (transparent when null). `ico`
 * lists the .ico files every `sizes` frame is packed into; without it the
 * single rendered frame is written to `out` as a PNG.
 */
const TARGETS = [
  // Full-bleed favicon frames: at 16px every spare pixel counts, so the mark's
  // own padding is cropped away rather than shrinking it further.
  { sizes: [16, 32, 48, 64], pad: 1, bg: null, ico: FAVICON_ICO },

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

  // electron-builder derives the macOS .icns from this, and the Electron main
  // process loads it as the window icon; 1024 gives macOS a real retina source
  // instead of upscaling 512.
  {
    out: 'resources/icon.png',
    sizes: [1024],
    pad: ART.size / VIEWBOX,
    bg: null,
  },

  // The Windows 11 app icon, packed here rather than left to electron-builder
  // so every frame is rendered from the vector instead of downscaled from one
  // 1024px raster. These are the frames Windows asks for: 16-24 in the title
  // bar and Explorer lists, 32-64 on the desktop and taskbar, 96-256 in Start,
  // the jump list and large Explorer views. 256 is the largest an .ico holds.
  // The padding matches resources/icon.png so the mark does not jump size as
  // Windows switches frames across DPI scales, and the alpha is kept because
  // Windows composites the icon over whatever is behind it.
  {
    sizes: [16, 20, 24, 32, 40, 48, 64, 96, 128, 256],
    pad: ART.size / VIEWBOX,
    bg: null,
    ico: WINDOWS_ICO,
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

/**
 * Decode a non-interlaced 8-bit PNG (what Chrome screenshots always are) into
 * flat RGB or RGBA bytes.
 */
function decodePng(png) {
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  let p = 8; // signature

  while (p < png.length) {
    const len = png.readUInt32BE(p);
    const type = png.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') {
      width = png.readUInt32BE(p + 8);
      height = png.readUInt32BE(p + 12);
      const depth = png.readUInt8(p + 16);
      const colour = png.readUInt8(p + 17);
      const interlace = png.readUInt8(p + 20);
      if (depth !== 8 || interlace !== 0 || (colour !== 2 && colour !== 6)) {
        throw new Error(
          `unsupported PNG: depth ${depth}, colour type ${colour}, interlace ${interlace}`
        );
      }
      channels = colour === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      idat.push(png.subarray(p + 8, p + 8 + len));
    }
    p += 12 + len;
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = Buffer.alloc(height * stride);

  // Undo the per-scanline filter each row was encoded with.
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const cur = data.subarray(y * stride, (y + 1) * stride);
    const prev = y ? data.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = raw[src + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`bad PNG filter ${filter}`);
      cur[x] = v & 0xff;
    }
    src += stride;
  }

  return { width, height, channels, data };
}

// sRGB is not a linear measure of light, so averaging its bytes directly
// makes an antialiased edge come out darker (and, on a light plate, thinner)
// than the shape really is. Every average below is taken in linear light.
const TO_LINEAR = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(v) {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
}

/**
 * Average each `factor`x`factor` block of the supersampled render down to one
 * output pixel: a box filter over an exact integer ratio, which is what
 * supersampling asks for and, unlike a sharpening kernel, cannot ring on the
 * mark's hard edges. Colour is weighted by coverage (premultiplied) so
 * transparent pixels never bleed their colour into the edge.
 */
function downsample({ width, height, channels, data }, factor) {
  if (factor === 1) return { width, height, channels, data };

  const w = width / factor;
  const h = height / factor;
  const out = Buffer.alloc(w * h * channels);
  const samples = factor * factor;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < factor; sy++) {
        let s = ((y * factor + sy) * width + x * factor) * channels;
        for (let sx = 0; sx < factor; sx++, s += channels) {
          const alpha = channels === 4 ? data[s + 3] / 255 : 1;
          r += TO_LINEAR[data[s]] * alpha;
          g += TO_LINEAR[data[s + 1]] * alpha;
          b += TO_LINEAR[data[s + 2]] * alpha;
          a += alpha;
        }
      }
      const o = (y * w + x) * channels;
      if (a === 0) continue; // fully transparent: leave the zeroed pixel
      out[o] = fromLinear(r / a);
      out[o + 1] = fromLinear(g / a);
      out[o + 2] = fromLinear(b / a);
      if (channels === 4) out[o + 3] = Math.round((a / samples) * 255);
    }
  }

  return { width: w, height: h, channels, data: out };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function pngChunk(type, data) {
  const b = Buffer.alloc(12 + data.length);
  b.writeUInt32BE(data.length, 0);
  b.write(type, 4, 'ascii');
  data.copy(b, 8);
  b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length);
  return b;
}

/**
 * Encode RGB/RGBA bytes as a PNG, choosing each scanline's filter by the
 * standard minimum-sum-of-absolute-differences heuristic and deflating at
 * maximum effort. Carries no timestamps or colour-profile chunks, so the
 * output is byte-identical run to run.
 */
function encodePng({ width, height, channels, data }) {
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  const candidate = Buffer.alloc(stride);
  let out = 0;

  for (let y = 0; y < height; y++) {
    const cur = data.subarray(y * stride, (y + 1) * stride);
    const prev = y ? data.subarray((y - 1) * stride, y * stride) : null;
    let bestType = 0;
    let bestScore = Infinity;
    let best = null;

    for (let type = 0; type < 5; type++) {
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= channels ? cur[x - channels] : 0;
        const b = prev ? prev[x] : 0;
        const c = prev && x >= channels ? prev[x - channels] : 0;
        let v = cur[x];
        if (type === 1) v -= a;
        else if (type === 2) v -= b;
        else if (type === 3) v -= (a + b) >> 1;
        else if (type === 4) v -= paeth(a, b, c);
        v &= 0xff;
        candidate[x] = v;
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) {
        bestScore = score;
        bestType = type;
        best = Buffer.from(candidate);
      }
    }

    raw[out++] = bestType;
    best.copy(raw, out);
    out += stride;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(channels === 4 ? 6 : 2, 9); // RGBA or RGB
  // 10-12: deflate, adaptive filtering, no interlace — all zero.

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9, memLevel: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Drop the alpha channel when nothing in the image is transparent. */
function dropOpaqueAlpha(img) {
  if (img.channels !== 4) return img;
  for (let i = 3; i < img.data.length; i += 4) {
    if (img.data[i] !== 255) return img;
  }
  const out = Buffer.alloc((img.data.length / 4) * 3);
  for (let s = 0, d = 0; s < img.data.length; s += 4, d += 3) {
    out[d] = img.data[s];
    out[d + 1] = img.data[s + 1];
    out[d + 2] = img.data[s + 2];
  }
  return { width: img.width, height: img.height, channels: 3, data: out };
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

// Every frame is rasterized this many pixels wide before being averaged down.
// The factor stays a whole number so each output pixel is a clean average of
// the same number of samples; 32x is past the point of visible improvement.
const SUPERSAMPLE_TARGET = 2048;
const MAX_SUPERSAMPLE = 32;

const supersampleFor = (size) =>
  Math.max(1, Math.min(MAX_SUPERSAMPLE, Math.floor(SUPERSAMPLE_TARGET / size)));

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

  /**
   * Render the mark at `size` px, scaled to `pad` of the canvas.
   *
   * Chrome antialiases an edge from the one sample it takes per pixel, which
   * at icon sizes leaves the mask cuts and the A's diagonals visibly stepped.
   * So nothing is ever rasterized at its final size: each frame is drawn at an
   * exact whole multiple of it and averaged back down, which is many samples
   * per output pixel instead of one.
   */
  const render = async (size, pad, bg, keepAlpha) => {
    const ss = supersampleFor(size);
    const canvas = size * ss;
    // Round the artwork box to whole supersampled pixels so it stays centred.
    const art = Math.round(canvas * pad);

    await page.setViewport({
      width: canvas,
      height: canvas,
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>
         html,body{margin:0;padding:0;background:${bg ?? 'transparent'}}
         body{width:${canvas}px;height:${canvas}px;display:grid;place-items:center}
         img{width:${art}px;height:${art}px;display:block}
       </style>
       <img src="${dataUri}">`,
      { waitUntil: 'load' }
    );
    // Newer puppeteer hands back a Uint8Array, not a Buffer.
    const shot = await page.screenshot({ type: 'png', omitBackground: !bg });
    const small = downsample(decodePng(Buffer.from(shot)), ss);
    // An .ico directory entry declares 32bpp, so its frames keep their alpha
    // channel even when nothing in them is transparent.
    return encodePng(keepAlpha ? small : dropOpaqueAlpha(small));
  };

  const written = [];
  for (const target of TARGETS) {
    const rendered = [];
    for (const size of target.sizes) {
      rendered.push({
        size,
        png: await render(size, target.pad, target.bg, Boolean(target.ico)),
      });
    }

    if (target.ico) {
      const ico = buildIco(rendered);
      for (const out of target.ico) {
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
