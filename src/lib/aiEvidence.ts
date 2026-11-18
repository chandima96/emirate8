/* Evidence check shared by listing and profile autofill.
 *
 * Every AI answer carries a short verbatim quote from its source. For text sources (web pages, pasted
 * text, .txt files) the quote is looked up in the source: an answer whose quote isn't there was not read
 * from it. PDFs and images have no text on the server, so they are not checked.
 * Quotes are compared on letters and digits only, so spacing, punctuation and markdown don't matter.
 */

const compact = (value: string) => value.normalize('NFKC').replace(/&amp;/gi, '&').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// A quote may stitch several fragments of the page together ("swimming pools, Rooftop Lounge", "maid's room
// and a dedicated study"), so it is split into fragments and each is looked up. Commas inside numbers
// ("4,400,000") don't split. Every fragment must still be on the page, so splitting never loosens a check
// beyond "each part was read from the source".
const FRAGMENT_SPLIT = /\s*(?:\||;|\n|…|\.{3}|,(?!\d)|\s(?:and|&|\+)\s)\s*/i;

export function evidenceIn(evidence: string, sourceText: string) {
  const parts = String(evidence || '').split(FRAGMENT_SPLIT).map(compact).filter((part) => part.length >= 2);
  const source = compact(sourceText);
  const found = parts.filter((part) => source.includes(part)).length;
  return { all: parts.length > 0 && found === parts.length, any: found > 0 };
}

export type Evidence = Record<string, string | string[]>;

/**
 * Removes answers a text source does not support and returns what it removed ("key", or "key:value" for
 * one item of a list).
 * - `skip`: keys never checked (text the model writes or rewrites, such as a description or bio).
 * - `lenient`: keys kept when any fragment of the quote matches (answers read from the page as a whole).
 * Lists with one quote per item keep exactly the items whose quote matches; object items (a job, a link)
 * combine several facts, so any matching fragment is enough for them. A list with one shared quote is kept
 * when that quote matches in part.
 */
export function dropUnsupported(suggestions: Record<string, any>, evidence: Evidence, sourceText: string, opts: { skip?: string[]; lenient?: string[] } = {}) {
  const skip = opts.skip || [];
  const lenient = opts.lenient || [];
  const removed: string[] = [];
  for (const key of Object.keys(suggestions)) {
    if (skip.includes(key)) continue;
    const value = suggestions[key];
    const quotes = evidence[key];
    if (Array.isArray(value) && Array.isArray(quotes) && quotes.length === value.length) {
      const kept = value.filter((item, i) => {
        const check = evidenceIn(quotes[i], sourceText);
        if ((item && typeof item === 'object') || lenient.includes(key) ? check.any : check.all) return true;
        removed.push(`${key}:${typeof item === 'object' ? JSON.stringify(item).slice(0, 60) : item}`);
        return false;
      });
      if (kept.length) suggestions[key] = kept; else delete suggestions[key];
      continue;
    }
    const check = evidenceIn(Array.isArray(quotes) ? quotes.join(' | ') : quotes || '', sourceText);
    if (Array.isArray(value) || lenient.includes(key) ? check.any : check.all) continue;
    delete suggestions[key];
    removed.push(key);
  }
  return removed;
}
