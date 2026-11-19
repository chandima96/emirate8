/*
 * Deterministic checks on what the SEO content agent wants to save. Failures go back to the agent as
 * tool errors so it can correct itself; content that never passes is not stored.
 */

export type SeoDraft = {
  title: string;
  metaDescription: string;
  faq: { question: string; answer: string }[];
  issues: string[];
};

export const LIMITS = {
  title: [20, 60],
  metaDescription: [70, 160],
  faq: [3, 5],
  question: [10, 120],
  answer: [20, 320],
  issues: 10,
} as const;

/** Claims the agent must never make unless the record itself says so. */
const CLAIMS: [RegExp, string][] = [
  [/\b(rental )?yields?\b/i, 'rental yield'],
  [/\broi\b|return on investment|investment returns?/i, 'investment returns'],
  [/capital (appreciation|growth)/i, 'capital appreciation'],
  [/guarantee/i, 'guarantees'],
  [/\b(best|cheapest|lowest price|#1|number one)\b/i, 'superlatives'],
  [/below market|under market|bargain/i, 'market comparisons'],
  [/golden visa/i, 'visa eligibility'],
  [/\bmortgage\b/i, 'mortgage terms'],
];

/** Links, emails and UAE phone numbers (+971 / 00971 / 05x…). Long prices are not mistaken for phones. */
const CONTACT = /(https?:\/\/|www\.|\S+@\S+\.\w+|(?:\+971|\b00971|\b05\d)[\d\s-]{6,}\d)/i;

const MULTIPLIER: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, bn: 1e9, billion: 1e9 };

/* Spelled-out counts, so “two bedrooms” is checked like “2 bedrooms”. “One” is left out: “one of the…”
 * is ordinary prose, not a claim. */
const WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

/** Every number written in a text, with “2.5M”, “2,500,000” and “2.5 million” all read as 2500000. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|mn|m|million|bn|billion)?\b/gi;
  for (const m of String(text).matchAll(re)) {
    const base = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(base)) continue;
    const mult = m[2] ? MULTIPLIER[m[2].toLowerCase()] || 1 : 1;
    out.push(Math.round(base * mult * 100) / 100);
  }
  for (const m of String(text).matchAll(/\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi))
    out.push(WORDS[m[1].toLowerCase()]);
  return out;
}

/** All numbers present anywhere in the facts (values and numbers inside strings). */
export function factNumbers(facts: unknown, into = new Set<number>()): Set<number> {
  if (typeof facts === 'number') into.add(Math.round(facts * 100) / 100);
  else if (typeof facts === 'string') numbersIn(facts).forEach((n) => into.add(n));
  else if (Array.isArray(facts)) facts.forEach((v) => factNumbers(v, into));
  else if (facts && typeof facts === 'object') Object.values(facts).forEach((v) => factNumbers(v, into));
  return into;
}

const factText = (facts: unknown) => JSON.stringify(facts).toLowerCase();

const lengthError = (label: string, value: string, [min, max]: readonly [number, number]) =>
  value.length < min || value.length > max ? `${label} is ${value.length} characters; it must be ${min}–${max}.` : '';

/** Returns a list of problems; an empty list means the draft can be saved. */
export function validateSeoDraft(draft: SeoDraft, facts: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!draft || typeof draft !== 'object') return ['The content is missing.'];
  const title = String(draft.title || '').trim();
  const meta = String(draft.metaDescription || '').trim();
  const faq = Array.isArray(draft.faq) ? draft.faq : [];
  const issues = Array.isArray(draft.issues) ? draft.issues : [];

  errors.push(lengthError('The title', title, LIMITS.title), lengthError('The meta description', meta, LIMITS.metaDescription));
  if (/emirate0?8/i.test(title)) errors.push('Leave the site name out of the title; it is added automatically.');
  if (faq.length < LIMITS.faq[0] || faq.length > LIMITS.faq[1])
    errors.push(`Write ${LIMITS.faq[0]}–${LIMITS.faq[1]} FAQ entries (got ${faq.length}).`);
  faq.forEach((f, i) => {
    errors.push(
      lengthError(`FAQ ${i + 1} question`, String(f?.question || '').trim(), LIMITS.question),
      lengthError(`FAQ ${i + 1} answer`, String(f?.answer || '').trim(), LIMITS.answer),
    );
  });
  if (issues.length > LIMITS.issues) errors.push(`List at most ${LIMITS.issues} issues.`);

  const fields: [string, string][] = [
    ['title', title],
    ['meta description', meta],
    ...faq.flatMap((f, i): [string, string][] => [
      [`FAQ ${i + 1} question`, String(f?.question || '')],
      [`FAQ ${i + 1} answer`, String(f?.answer || '')],
    ]),
  ];
  errors.push(...groundingProblems(fields, facts));
  return errors.filter(Boolean);
}

/** Numbers, claims and contact details in each text, checked against the facts. */
function groundingProblems(fields: [string, string][], facts: Record<string, unknown>) {
  const errors: string[] = [];
  const known = factNumbers(facts);
  const source = factText(facts);
  for (const [label, text] of fields) {
    const unknown = [...new Set(numbersIn(text).filter((n) => !known.has(n)))];
    if (unknown.length)
      errors.push(`The ${label} contains ${unknown.join(', ')}, which is not in the facts. Use only numbers from the facts, written in full or exactly.`);
    for (const [re, name] of CLAIMS) if (re.test(text) && !re.test(source)) errors.push(`The ${label} mentions ${name}, which the facts do not support.`);
    if (CONTACT.test(text)) errors.push(`The ${label} contains a link, email address or phone number; leave contact details out.`);
  }
  return errors;
}

/** Editor limits for the listing's own title and description (designer-schema: max 100 / 5000). */
export const REWRITE_LIMITS = { listingTitle: [20, 100], listingDescription: [200, 5000] } as const;

export type ListingRewrite = { listingTitle: string; listingDescription: string };

/** Checks the rewritten listing title and description with the same grounding rules as the SEO text. */
export function validateListingRewrite(rewrite: ListingRewrite, facts: Record<string, unknown>): string[] {
  const title = String(rewrite?.listingTitle || '').trim();
  const description = String(rewrite?.listingDescription || '').trim();
  return [
    lengthError('The listing title', title, REWRITE_LIMITS.listingTitle),
    lengthError('The listing description', description, REWRITE_LIMITS.listingDescription),
    ...groundingProblems(
      [
        ['listing title', title],
        ['listing description', description],
      ],
      facts,
    ),
  ].filter(Boolean);
}
