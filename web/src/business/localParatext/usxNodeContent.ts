import xpath from 'xpath';
import {
  isAfterSection,
  isPara,
  isSection,
  isText,
  isVerse,
} from './usxNodeType';
import { Passage } from '../../model';
import { vInt } from './vInt';

const vrefRe = /^([0-9]+[a-f]?)[^0-9]?([0-9]+[a-f]?)?$/;

export const domVnum = (v: Element) => {
  const vrefAttr = v.getAttribute('number');
  const vrefMatch = vrefAttr ? vrefRe.exec(vrefAttr) : null;
  if (vrefMatch) {
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    const [_, vstart, vend] = vrefMatch;
    return [vInt(vstart), vInt(vend) || vInt(vstart)];
  }
  return [];
};

export const firstVerse = (para: Node) => {
  let verse = para.firstChild;
  while (verse && !isVerse(verse)) verse = verse?.nextSibling;
  return verse as Element;
};

export const bruteForceVerses = (node: Node | null, verses: Element[]) => {
  for (let n = node; n !== null; n = n.nextSibling) {
    if (isVerse(n)) {
      verses.push(n as Element);
    }
    bruteForceVerses(n.firstChild, verses);
  }
};

export const getVerses = (node: Node) => {
  try {
    if (isPara(node)) {
      const verses: Element[] = [];
      for (
        let n: Node | null = node.firstChild;
        n !== null;
        n = n.nextSibling
      ) {
        if (isVerse(n)) {
          verses.push(n as Element);
        }
      }
      return verses;
    } else return xpath.select('//verse', node) as Element[];
  } catch {
    //let sDebug = xmlSerializer.serializeToString(node);
    const verses: Element[] = [];
    bruteForceVerses(node, verses);
    return verses;
  }
};

export const getExistingVerses = (
  doc: Document,
  p: Passage,
  includeExact: boolean = false
) => {
  const verses = getVerses(doc.documentElement);
  const allVerses = Array<Element>();
  const first = p?.attributes.startVerse || 0;
  const last = p?.attributes.endVerse || 0;
  let exactVerse: Element | undefined;
  verses.forEach((v) => {
    // eslint-disable-next-line prefer-const
    let [vstart, vend] = domVnum(v);
    if (vstart) {
      if (vstart === first && vend === last) {
        exactVerse = v;
        if (!includeExact) {
          vstart = 0;
          if (p.attributes.sequencenum === 1 && isAfterSection(v))
            allVerses.push(isAfterSection(v) as Element);
        }
      }
      if (vstart >= first && vend <= last && !allVerses.includes(v)) {
        allVerses.push(v);
        if (p.attributes.sequencenum === 1 && isAfterSection(v))
          allVerses.push(isAfterSection(v) as Element);
      }
    }
  });
  return { allVerses, exactVerse };
};

export const getPassageVerses = (doc: Document, p: Passage) => {
  const existing = getExistingVerses(doc, p, true);
  if (existing.allVerses.length === 0) throw new Error('no range');
  let transcription = '';
  existing.allVerses.forEach((v) => {
    if (isVerse(v))
      transcription +=
        '\\v ' +
        v.getAttribute('number') +
        ' ' +
        verseText(v).replace('\\p', '\r');
  });
  return transcription;
};

export const logUsxStructure = (doc: Document, label?: string) => {
  const root = doc.documentElement;
  const lines: string[] = [];
  for (let i = 0; i < root.childNodes.length; i++) {
    const node = root.childNodes[i];
    if (isPara(node)) {
      const el = node as Element;
      const style = el.getAttribute('style') || '?';
      let content = '';
      for (let j = 0; j < el.childNodes.length; j++) {
        const child = el.childNodes[j];
        if (isVerse(child))
          content += `\\v ${(child as Element).getAttribute('number') || '?'} `;
        else if (isSection(child)) content += `[s] `;
        else if (isText(child)) {
          const txt = (child.nodeValue || '').replace(/[\r\n]/g, '');
          if (txt) content += txt;
        }
      }
      lines.push(`\\${style} ${content}`.trimEnd());
    } else if (isText(node)) {
      const txt = (node.nodeValue || '').trim();
      if (txt) lines.push(txt);
    }
  }
  console.log(`--- ${label ?? 'USX'} ---\n` + lines.join('\n'));
};

export const verseText = (v: Element) => {
  let next: Node | undefined | null =
    v.firstChild || v.nextSibling || v.parentNode?.nextSibling;
  let text = '';
  while (next) {
    if (isSection(next) || isVerse(next)) next = null;
    else if (isText(next)) {
      text += next.nodeValue;
    }
    if (next)
      next =
        next.firstChild || next.nextSibling || next.parentNode?.nextSibling;
  }
  return text;
};
