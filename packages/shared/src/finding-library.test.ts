import { describe, it, expect } from 'vitest';
import { FINDING_TEMPLATE_LIBRARY } from './finding-library';
import { OWASP_CATEGORIES, SEVERITIES } from './constants';

const validCodes = new Set(OWASP_CATEGORIES.map((c) => c.code));
const codeToFamily = new Map(OWASP_CATEGORIES.map((c) => [c.code, c.family]));

/**
 * Expected coverage per subcategory/vector. The sum (84) is the contract of
 * the standardized library; changing it requires a deliberate update of this
 * test.
 */
const EXPECTED_PER_CODE: Record<string, number> = {
  // Web 2021 — 40
  'A01:2021': 6,
  'A02:2021': 4,
  'A03:2021': 6,
  'A04:2021': 4,
  'A05:2021': 4,
  'A06:2021': 3,
  'A07:2021': 4,
  'A08:2021': 3,
  'A09:2021': 3,
  'A10:2021': 3,
  // API 2023 — 20
  'API1:2023': 1,
  'API2:2023': 3,
  'API3:2023': 2,
  'API4:2023': 3,
  'API5:2023': 1,
  'API6:2023': 1,
  'API7:2023': 1,
  'API8:2023': 3,
  'API9:2023': 3,
  'API10:2023': 2,
  // LLM — 24
  LLM01: 2,
  LLM02: 3,
  LLM03: 3,
  LLM04: 2,
  LLM05: 3,
  LLM06: 2,
  LLM07: 1,
  LLM08: 2,
  LLM09: 3,
  LLM10: 3,
};

describe('FINDING_TEMPLATE_LIBRARY', () => {
  it('has 84 findings (40 Web + 20 API + 24 LLM)', () => {
    expect(FINDING_TEMPLATE_LIBRARY).toHaveLength(84);
  });

  it('every owaspCode references an existing category, with a consistent family', () => {
    for (const e of FINDING_TEMPLATE_LIBRARY) {
      expect(validCodes.has(e.owaspCode)).toBe(true);
      expect(e.family).toBe(codeToFamily.get(e.owaspCode));
    }
  });

  it('covers the expected subcategory count per OWASP category', () => {
    const counts: Record<string, number> = {};
    for (const e of FINDING_TEMPLATE_LIBRARY) {
      counts[e.owaspCode] = (counts[e.owaspCode] ?? 0) + 1;
    }
    expect(counts).toEqual(EXPECTED_PER_CODE);
  });

  it('titles are unique and non-empty', () => {
    const titles = FINDING_TEMPLATE_LIBRARY.map((e) => e.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles.every((t) => t.trim().length > 0)).toBe(true);
  });

  it('every entry has a valid severity and required content filled in', () => {
    for (const e of FINDING_TEMPLATE_LIBRARY) {
      expect(SEVERITIES).toContain(e.severity);
      expect(e.descriptionMd.trim().length).toBeGreaterThan(0);
      expect(e.recommendationMd.trim().length).toBeGreaterThan(0);
      expect(e.referencesMd.trim().length).toBeGreaterThan(0);
    }
  });

  it('every entry carries the library traceability tag', () => {
    for (const e of FINDING_TEMPLATE_LIBRARY) {
      expect(e.tags).toContain('owasp-library');
    }
  });
});
