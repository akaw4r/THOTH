import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SECTIONS,
  METHODOLOGY_MD,
  OWASP_CATEGORIES,
  OWASP_FAMILIES,
  OWASP_FAMILY_LABELS,
} from './constants';

describe('OWASP_CATEGORIES', () => {
  it('has 30 items (10 Web + 10 API + 10 LLM)', () => {
    expect(OWASP_CATEGORIES).toHaveLength(30);
    expect(OWASP_CATEGORIES.filter((c) => c.family === 'WEB')).toHaveLength(10);
    expect(OWASP_CATEGORIES.filter((c) => c.family === 'API')).toHaveLength(10);
    expect(OWASP_CATEGORIES.filter((c) => c.family === 'LLM')).toHaveLength(10);
  });

  it('codes are unique (natural identity for the upsert)', () => {
    const codes = OWASP_CATEGORIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('order runs from 1 to 10 within each family', () => {
    for (const family of OWASP_FAMILIES) {
      const orders = OWASP_CATEGORIES.filter((c) => c.family === family)
        .map((c) => c.order)
        .sort((a, b) => a - b);
      expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it('every family has a label', () => {
    for (const family of OWASP_FAMILIES) {
      expect(OWASP_FAMILY_LABELS[family]).toBeTruthy();
    }
  });
});

describe('METHODOLOGY_MD', () => {
  it('lists every OWASP category (Web/API/LLM) — none missing', () => {
    const missing = OWASP_CATEGORIES.filter((c) => !METHODOLOGY_MD.includes(c.code));
    expect(missing.map((c) => c.code)).toEqual([]);
  });

  it('references OWASP ASVS as the verification standard', () => {
    expect(METHODOLOGY_MD).toContain('ASVS');
  });

  it('mentions the label of every OWASP family', () => {
    for (const family of OWASP_FAMILIES) {
      expect(METHODOLOGY_MD).toContain(OWASP_FAMILY_LABELS[family]);
    }
  });

  it('is the content of the default Methodology section of every report', () => {
    const methodology = DEFAULT_SECTIONS.find((s) => s.slug === 'methodology');
    expect(methodology?.contentMd).toBe(METHODOLOGY_MD);
  });
});
