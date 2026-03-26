/* eslint-disable @typescript-eslint/no-require-imports */
const { DOMParser } = require('@xmldom/xmldom');

function toInt(value) {
  const n = parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function parseVerseNumber(value) {
  const m = String(value ?? '').match(/^(\d+)/);
  return m ? toInt(m[1]) : null;
}

/** Split a USFM line on inline \\v markers (anywhere in the line). */
function parseInlineVerseSegments(line) {
  const segments = [];
  const re = /\\v\s+([0-9]+(?:-[0-9]+)?[a-z]?)\s*/gi;
  let lastIndex = 0;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m.index > lastIndex) {
      const text = line.slice(lastIndex, m.index);
      if (text) {
        segments.push({ type: 'text', text });
      }
    }
    segments.push({ type: 'verse', number: m[1] });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < line.length) {
    const text = line.slice(lastIndex);
    if (text) {
      segments.push({ type: 'text', text });
    }
  }
  return segments;
}

function rebuildParaText(para) {
  para.text = para.content
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function appendSegmentsToPara(para, segments) {
  for (const seg of segments) {
    if (seg.type === 'verse') {
      para.content.push({ type: 'verse', number: seg.number });
    } else if (seg.type === 'text' && seg.text) {
      para.content.push({ type: 'text', text: seg.text });
    }
  }
  rebuildParaText(para);
}

function normalizeTextToUsj(input, inputFormat) {
  const format = String(inputFormat ?? '')
    .trim()
    .toLowerCase();
  if (format === 'usj') {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    return parsed;
  }
  if (format === 'usx') {
    return usxToUsj(String(input ?? ''));
  }
  if (format === 'usfm') {
    return usfmToUsj(String(input ?? ''));
  }
  throw new Error(`Unsupported text format for normalization: ${inputFormat}`);
}

function usxToUsj(usxXml) {
  const doc = new DOMParser().parseFromString(usxXml, 'application/xml');
  const root = doc.documentElement;
  const children = [];

  function walk(node) {
    if (!node || !node.nodeName) {
      return;
    }
    const name = String(node.nodeName).toLowerCase();
    if (name === 'chapter') {
      const number = toInt(node.getAttribute('number'));
      children.push({ type: 'chapter', number });
      return;
    }
    if (name === 'para') {
      const style = node.getAttribute('style') || '';
      const para = { type: 'para', marker: style, text: '', content: [] };
      const childNodes = node.childNodes ? Array.from(node.childNodes) : [];
      childNodes.forEach((child) => {
        if (child.nodeType === 3) {
          const text = String(child.nodeValue ?? '');
          if (text.trim()) {
            para.content.push({ type: 'text', text });
          }
          return;
        }
        const childName = String(child.nodeName ?? '').toLowerCase();
        if (childName === 'verse') {
          const rawNum = child.getAttribute('number');
          if (rawNum == null || String(rawNum).trim() === '') {
            return;
          }
          para.content.push({
            type: 'verse',
            number: String(rawNum).trim(),
          });
          return;
        }
        if (childName === 'char') {
          const text = String(child.textContent ?? '');
          if (text.trim()) {
            para.content.push({ type: 'text', text });
          }
          return;
        }
        const text = String(child.textContent ?? '');
        if (text.trim()) {
          para.content.push({ type: 'text', text });
        }
      });
      para.text = para.content
        .filter((item) => item.type === 'text')
        .map((item) => item.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      children.push(para);
    }
  }

  const nodes = root?.childNodes ? Array.from(root.childNodes) : [];
  nodes.forEach(walk);
  return { type: 'USJ', version: '0.3.0', content: children };
}

function usfmToUsj(usfmText) {
  const content = [];
  let currentChapter = null;
  let currentPara = null;

  const lines = String(usfmText ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n');

  function ensurePara(marker = 'p') {
    if (!currentPara) {
      currentPara = { type: 'para', marker, text: '', content: [] };
      content.push(currentPara);
    }
    return currentPara;
  }

  function processUsfmFragment(fragment) {
    const line = fragment.trim();
    if (!line) {
      return;
    }

    const paraMatch = line.match(/^\\(p|m|q\d*|pi\d*)\s*(.*)$/);
    if (paraMatch) {
      const para = {
        type: 'para',
        marker: paraMatch[1],
        text: '',
        content: [],
      };
      const paraTail = paraMatch[2]?.trim() ?? '';
      if (paraTail) {
        if (/\\v\s+/i.test(paraTail)) {
          appendSegmentsToPara(para, parseInlineVerseSegments(paraTail));
        } else {
          para.content.push({ type: 'text', text: paraTail });
          para.text = paraTail;
        }
      }
      content.push(para);
      currentPara = para;
      return;
    }

    if (/^\\v\s+/i.test(line)) {
      const para = ensurePara('p');
      appendSegmentsToPara(para, parseInlineVerseSegments(line));
      return;
    }

    const ignoredMarkerMatch = line.match(/^\\([a-z0-9]+)\b/i);
    if (ignoredMarkerMatch) {
      return;
    }

    const para = ensurePara('p');
    if (/\\v\s+/i.test(line)) {
      appendSegmentsToPara(para, parseInlineVerseSegments(line));
    } else {
      para.content.push({ type: 'text', text: line });
      rebuildParaText(para);
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const chapterMatch = line.match(/^\\c\s+(\d+)/);
    if (chapterMatch) {
      currentChapter = toInt(chapterMatch[1]);
      content.push({ type: 'chapter', number: currentChapter });
      currentPara = null;
      continue;
    }

    const sectionMatch = line.match(/^\\(s\d*)\s*(.*)$/);
    if (sectionMatch) {
      const para = {
        type: 'para',
        marker: sectionMatch[1],
        text: '',
        content: [],
      };
      const title = sectionMatch[2]?.trim();
      if (title) {
        para.content.push({ type: 'text', text: title });
        para.text = title;
      }
      content.push(para);
      currentPara = null;
      continue;
    }

    const parts = line.split(/\\p\s*/);
    for (let pi = 0; pi < parts.length; pi++) {
      const piece = parts[pi].trim();
      if (piece.length === 0) {
        currentPara = null;
        continue;
      }
      if (pi > 0) {
        currentPara = null;
      }
      processUsfmFragment(piece);
    }
  }

  if (currentChapter === null) {
    content.unshift({ type: 'chapter', number: 1 });
  }

  return { type: 'USJ', version: '0.3.0', content };
}

/** Verse min/max from USJ/USFM verse number (may be range like "47-55"). */
function verseNumbersForSpan(item) {
  if (!item || item.type !== 'verse') {
    return [];
  }
  const raw = String(item.number ?? '').trim();
  if (!raw) {
    return [];
  }
  const m = raw.match(/^(\d+)(?:-(\d+))?/);
  if (!m) {
    return [];
  }
  const a = toInt(m[1]);
  const b = m[2] ? toInt(m[2]) : a;
  if (!Number.isFinite(a)) {
    return [];
  }
  if (!Number.isFinite(b)) {
    return [a];
  }
  return [a, b];
}

function paraTextFromNode(node) {
  const direct = String(node.text ?? '').trim();
  if (direct) {
    return direct;
  }
  const paraContent = Array.isArray(node.content) ? node.content : [];
  const fromStrings = paraContent
    .filter((item) => typeof item === 'string')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  if (fromStrings) {
    return fromStrings;
  }
  return paraContent
    .filter((item) => item && item.type === 'text' && item.text)
    .map((item) => item.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractStructureFromUsj(usjDoc, scopeFilter) {
  const selectedChapters =
    Array.isArray(scopeFilter) && scopeFilter.length > 0
      ? new Set(
          scopeFilter
            .map((value) => toInt(value))
            .filter((value) => Number.isFinite(value))
        )
      : null;

  const nodes = Array.isArray(usjDoc?.content) ? usjDoc.content : [];
  const sections = [];
  const paragraphs = [];

  let chapter = 1;
  let activeSectionIndex = -1;
  let fallbackSectionUsed = false;

  function ensureSection(name) {
    const section = {
      name: name || `Section ${sections.length + 1}`,
      sequencenum: sections.length + 1,
      level: 3,
      startChapter: null,
      startVerse: null,
      endChapter: null,
      endVerse: null,
    };
    sections.push(section);
    activeSectionIndex = sections.length - 1;
    return section;
  }

  function shouldIncludeChapter(ch) {
    if (!selectedChapters || selectedChapters.size === 0) {
      return true;
    }
    return selectedChapters.has(ch);
  }

  function updateSectionSpan(section, startVerse, endVerse) {
    if (!section) {
      return;
    }
    if (section.startChapter == null) {
      section.startChapter = chapter;
      section.startVerse = startVerse ?? endVerse ?? 1;
    }
    section.endChapter = chapter;
    section.endVerse = endVerse ?? startVerse ?? section.endVerse ?? 1;
  }

  for (const node of nodes) {
    if (!node || typeof node !== 'object') {
      continue;
    }
    if (node.type === 'chapter') {
      const n = toInt(node.number);
      if (Number.isFinite(n)) {
        chapter = n;
      }
      continue;
    }
    if (node.type !== 'para') {
      continue;
    }
    if (!shouldIncludeChapter(chapter)) {
      continue;
    }

    const marker = String(node.marker ?? node.style ?? '').toLowerCase();
    if (/^s\d*$/.test(marker)) {
      const title = paraTextFromNode(node);
      ensureSection(title || `Section ${sections.length + 1}`);
      continue;
    }

    if (activeSectionIndex < 0) {
      fallbackSectionUsed = true;
      ensureSection('Text Content');
    }
    const section = sections[activeSectionIndex];
    const paraContent = Array.isArray(node.content) ? node.content : [];
    const verses = [];
    for (const item of paraContent) {
      verses.push(...verseNumbersForSpan(item));
    }
    const finiteVerses = verses.filter((num) => Number.isFinite(num));
    if (finiteVerses.length === 0) {
      continue;
    }
    const startVerse = Math.min(...finiteVerses);
    const endVerse = Math.max(...finiteVerses);
    paragraphs.push({
      sectionIndex: activeSectionIndex,
      chapter,
      startVerse,
      endVerse,
      title: paraTextFromNode(node),
    });
    updateSectionSpan(section, startVerse, endVerse);
  }

  if (sections.length === 0 && paragraphs.length === 0 && fallbackSectionUsed) {
    return { sections: [], paragraphs: [] };
  }

  sections.forEach((section) => {
    if (section.startChapter == null) {
      section.startChapter = 1;
      section.endChapter = 1;
      section.startVerse = 1;
      section.endVerse = 1;
    }
  });

  return { sections, paragraphs };
}

module.exports = {
  normalizeTextToUsj,
  extractStructureFromUsj,
};
