/**
 * Sentences for read-aloud.
 *
 * Read-aloud speaks one sentence at a time (one utterance each): it avoids
 * Chrome cutting long utterances off after about 15 seconds, and each
 * sentence's start drives the highlight.
 *
 *   splitSentences  Intl.Segmenter in the page's language. Very long
 *                   "sentences" (lists without full stops, legal text) are
 *                   split at a comma, semicolon or dash, else at a space.
 *   markSentences   Wraps every sentence of Focus Mode's article in
 *                   <span class="vf-sentence" data-sentence="N">, once, when
 *                   Focus Mode opens. A sentence that runs through a link or
 *                   bold text becomes several spans with the same number.
 *                   Only class changes happen while reading, so screen
 *                   readers never see the text move around.
 */

export const MAX_SENTENCE_CHARS = 200;

/** What's read: headings, paragraphs, list items, captions. Each is read separately. */
const UNITS = 'h1, h2, h3, h4, h5, h6, p, li, figcaption';
/** Never read: the byline/reading-time line, VisioFix's notices, code, the hover button. */
const NOT_READ = '.vf-meta, .vf-notice, .vf-play-here, pre';
/** A footnote marker in superscript ("1", "(2)", "[3]", "[note 1]", "[citation needed]"): shown, not read. */
const FOOTNOTE = /^\s*(\[[^\]]{1,24}\]|\(?\d{1,3}\)?)\s*$/;

export interface TextRange {
  start: number;
  end: number;
}

export interface MarkedSentence {
  text: string;
  /** The spans that make up the sentence, in order (more than one when it crosses a link). */
  spans: HTMLElement[];
}

const segmenters = new Map<string, Intl.Segmenter>();

function segmenterFor(lang: string | null): Intl.Segmenter {
  const key = lang ?? '';
  let segmenter = segmenters.get(key);
  if (!segmenter) {
    try {
      segmenter = new Intl.Segmenter(lang ?? undefined, { granularity: 'sentence' });
    } catch {
      // Not a valid language tag: the default rules work for most languages.
      segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
    }
    segmenters.set(key, segmenter);
  }
  return segmenter;
}

/** Sentence ranges in the text, without surrounding whitespace. Pieces with no letters or digits are skipped. */
export function splitSentences(text: string, lang: string | null): TextRange[] {
  const out: TextRange[] = [];
  for (const { segment, index } of segmenterFor(lang).segment(text)) {
    const range = trim(text, index, index + segment.length);
    if (!range || !/[\p{L}\p{N}]/u.test(text.slice(range.start, range.end))) continue;
    out.push(...splitLong(text, range));
  }
  return out;
}

function trim(text: string, start: number, end: number): TextRange | null {
  let a = start;
  let b = end;
  while (a < b && /\s/.test(text[a] ?? '')) a += 1;
  while (b > a && /\s/.test(text[b - 1] ?? '')) b -= 1;
  return a < b ? { start: a, end: b } : null;
}

function splitLong(text: string, range: TextRange): TextRange[] {
  const out: TextRange[] = [];
  let { start } = range;
  while (range.end - start > MAX_SENTENCE_CHARS) {
    const window = text.slice(start, start + MAX_SENTENCE_CHARS);
    let cut = -1;
    // The last comma, semicolon, colon or dash in the second half of the window.
    for (const match of window.matchAll(/[,;:—–]\s/g)) {
      if (match.index >= MAX_SENTENCE_CHARS / 2) cut = match.index + 1;
    }
    if (cut === -1) {
      const space = window.lastIndexOf(' ');
      cut = space > MAX_SENTENCE_CHARS / 2 ? space : MAX_SENTENCE_CHARS;
    }
    const piece = trim(text, start, start + cut);
    if (piece) out.push(piece);
    start += cut;
  }
  const rest = trim(text, start, range.end);
  if (rest) out.push(rest);
  return out;
}

/** Wraps every sentence of the article in spans. Returns them in reading order. */
export function markSentences(article: HTMLElement, lang: string | null): MarkedSentence[] {
  const doc = article.ownerDocument;
  const sentences: MarkedSentence[] = [];

  for (const unit of Array.from(article.querySelectorAll(UNITS))) {
    if (unit.closest(NOT_READ)) continue;
    const nodes = ownText(unit);
    const text = nodes.map((node) => node.data).join('');
    const ranges = splitSentences(text, lang);
    if (ranges.length === 0) continue;

    const base = sentences.length;
    for (const range of ranges) sentences.push({ text: text.slice(range.start, range.end), spans: [] });

    // Replace each text node with plain text and sentence spans.
    let r = 0;
    let offset = 0;
    for (const node of nodes) {
      const nodeStart = offset;
      const nodeEnd = offset + node.data.length;
      offset = nodeEnd;
      const parts: Node[] = [];
      let pos = nodeStart;
      while (r < ranges.length && (ranges[r] as TextRange).start < nodeEnd) {
        const range = ranges[r] as TextRange;
        const a = Math.max(range.start, nodeStart);
        const b = Math.min(range.end, nodeEnd);
        if (b > a) {
          if (a > pos) parts.push(doc.createTextNode(text.slice(pos, a)));
          const span = doc.createElement('span');
          span.className = 'vf-sentence';
          span.dataset.sentence = String(base + r);
          span.textContent = text.slice(a, b);
          sentences[base + r]?.spans.push(span);
          parts.push(span);
          pos = b;
        }
        if (range.end > nodeEnd) break; // the sentence continues in the next text node
        r += 1;
      }
      if (parts.length === 0) continue;
      if (pos < nodeEnd) parts.push(doc.createTextNode(text.slice(pos, nodeEnd)));
      node.replaceWith(...parts);
    }
  }
  return sentences;
}

/** The text nodes that belong to this unit: not to a unit inside it (a list inside a list item). */
function ownText(unit: Element): Text[] {
  const nodes: Text[] = [];
  const walker = unit.ownerDocument.createTreeWalker(unit, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
      const el = node as Element;
      if (el.matches(UNITS) || el.matches(NOT_READ)) return NodeFilter.FILTER_REJECT;
      if (el.localName === 'sup' && FOOTNOTE.test(el.textContent ?? '')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_SKIP;
    },
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
  return nodes;
}
