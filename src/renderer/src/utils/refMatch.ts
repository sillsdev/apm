export const refMatch = (ref: string): RegExpExecArray | null => {
  const m =
    /^([0-9]+)[:.]([0-9]+[a-e]?)-?([0-9]*[a-e]?)[:.]?([0-9]*[a-e]?)$/g.exec(
      ref
    );
  if (!m) return m;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, chapter, verseStart, arg3, verseEnd] = m;
  if (verseEnd) {
    if (parseInt(arg3 || '0') !== parseInt(chapter || '0') + 1) return null;
    return m;
  } else if (arg3) {
    // Same verse, letter-suffix range (e.g. 1:22a-b = verse 22, parts a through b).
    const sameVerseLetterEnd =
      /^[a-e]$/i.test(arg3) &&
      /^(\d+)([a-e])$/i.exec(verseStart || '');
    if (sameVerseLetterEnd) {
      const [, , startLetter] = sameVerseLetterEnd;
      const endLetter = arg3.toLowerCase();
      if (endLetter <= startLetter.toLowerCase()) return null;
      return m;
    }
    const vBeg = parseInt(verseStart || '');
    const vEnd = parseInt(arg3 || '');
    if (Number.isNaN(vBeg) || Number.isNaN(vEnd)) return null;
    if (vEnd < vBeg) return null;
    else if (vBeg === vEnd && arg3 <= (verseStart || '')) return null;
    return m;
  }
  return m;
};

export const chapterMatch = (ref: string): RegExpExecArray | null => {
  return /^([0-9]+)-?([0-9]*)$/g.exec(ref);
};
