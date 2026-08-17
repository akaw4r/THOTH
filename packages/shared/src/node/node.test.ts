import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  decryptBuffer,
  decryptString,
  encryptBuffer,
  encryptString,
  parseEncryptionKey,
  safeEqual,
} from './crypto';
import { renderMarkdown } from './markdown';
import { buildReportHtml } from './report-html';
import { DEFAULT_DESIGN } from './default-design';

describe('crypto (AES-256-GCM)', () => {
  const key = randomBytes(32);

  it('buffer roundtrip', () => {
    const plain = randomBytes(1024);
    const enc = encryptBuffer(plain, key);
    expect(enc.equals(plain)).toBe(false);
    expect(decryptBuffer(enc, key).equals(plain)).toBe(true);
  });

  it('string roundtrip', () => {
    const enc = encryptString('totp secret', key);
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(decryptString(enc, key)).toBe('totp secret');
  });

  it('detects tampered payload (auth tag)', () => {
    const enc = encryptBuffer(Buffer.from('data'), key);
    enc[enc.length - 1] ^= 0xff;
    expect(() => decryptBuffer(enc, key)).toThrow();
  });

  it('rejects key with wrong length', () => {
    expect(() => parseEncryptionKey(Buffer.from('short').toString('base64'))).toThrow();
    expect(parseEncryptionKey(randomBytes(32).toString('base64')).length).toBe(32);
    expect(parseEncryptionKey(randomBytes(32).toString('hex')).length).toBe(32);
  });

  it('safeEqual compares without leaking length', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
  });
});

describe('renderMarkdown', () => {
  it('renders basic markdown', () => {
    const html = renderMarkdown('# Title\n\n**strong** and `code`');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>strong</strong>');
    expect(html).toContain('<code>code</code>');
  });

  it('strips injected HTML and scripts', () => {
    const html = renderMarkdown('<script>alert(1)</script> [x](javascript:alert(1))');
    // No <script> tag and no executable href (the "javascript:" text may
    // remain as escaped visible content — that is harmless).
    expect(html).not.toContain('<script');
    expect(html).not.toMatch(/href\s*=\s*["']?\s*javascript:/i);
  });

  it('resolves attachment references', () => {
    const id = '11111111-2222-3333-4444-555555555555';
    const html = renderMarkdown(
      `![evidence](attachment:${id})`,
      (aid) => `/api/attachments/${aid}/raw`,
    );
    expect(html).toContain(`src="/api/attachments/${id}/raw"`);
  });
});

describe('buildReportHtml', () => {
  it('generates a complete document with the default design', () => {
    const html = buildReportHtml({
      design: DEFAULT_DESIGN,
      project: {
        name: 'Pentest App X',
        client: 'ACME Auto',
        scope: 'https://app.example.com',
        startDate: '2026-08-01',
        endDate: '2026-08-05',
        status: 'REPORTING',
      },
      sections: [{ title: 'Executive Summary', contentMd: 'Executive **summary**.' }],
      findings: [
        {
          title: 'SQL Injection in login',
          severity: 'CRITICAL',
          cvssScore: 9.8,
          cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
          status: 'FINAL',
          affectedAssets: ['https://app.example.com/login'],
          descriptionMd: 'Vulnerable `user` parameter.',
          impactMd: 'Full database access.',
          recommendationMd: 'Use parameterized queries.',
          referencesMd: '- https://owasp.org',
        },
        {
          title: 'Missing headers',
          severity: 'LOW',
          cvssScore: 3.1,
          cvssVector: null,
          status: 'DRAFT',
          affectedAssets: [],
          descriptionMd: 'No `X-Content-Type-Options`.',
          impactMd: '',
          recommendationMd: '',
          referencesMd: '',
        },
      ],
      meta: { generatedAt: new Date('2026-08-07T12:00:00Z'), generatedBy: 'tester@example.com' },
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Pentest App X');
    expect(html).toContain('SQL Injection in login');
    expect(html).toContain('F-01');
    expect(html).toContain('Critical');
    expect(html).toContain('Executive <strong>summary</strong>');
    // ordering: critical before low
    expect(html.indexOf('SQL Injection')).toBeLessThan(html.indexOf('Missing headers'));
  });

  it('includes the Table of Contents and places findings before the closing sections', () => {
    const html = buildReportHtml({
      design: DEFAULT_DESIGN,
      project: {
        name: 'Pentest App Y',
        client: 'ACME',
        scope: '',
        startDate: null,
        endDate: null,
        status: 'REPORTING',
      },
      sections: [
        { title: 'Executive Summary', slug: 'executive-summary', contentMd: 'Summary.' },
        { title: 'Methodology', slug: 'methodology', contentMd: 'Method.' },
        { title: 'Conclusion', slug: 'conclusion', contentMd: 'End.' },
      ],
      findings: [
        {
          title: 'BOLA in /loans',
          severity: 'HIGH',
          cvssScore: 8.1,
          cvssVector: null,
          status: 'FINAL',
          affectedAssets: [],
          descriptionMd: 'desc',
          impactMd: '',
          recommendationMd: '',
          referencesMd: '',
        },
      ],
      meta: { generatedAt: new Date('2026-08-13T12:00:00Z'), generatedBy: 'tester@example.com' },
    });

    // Table of Contents present, before "Engagement Details".
    expect(html).toContain('class="toc"');
    expect(html.indexOf('>Table of Contents<')).toBeLessThan(html.indexOf('Engagement Details'));

    // Findings (details) come BEFORE the Conclusion; the Methodology, before the findings.
    const idxMethodology = html.indexOf('id="sec-methodology"');
    const idxFindings = html.indexOf('id="sec-findings"');
    const idxConclusion = html.indexOf('id="sec-conclusion"');
    expect(idxMethodology).toBeGreaterThan(-1);
    expect(idxConclusion).toBeGreaterThan(-1);
    expect(idxMethodology).toBeLessThan(idxFindings);
    expect(idxFindings).toBeLessThan(idxConclusion);

    // Finding anchor and page placeholder in the Table of Contents.
    expect(html).toContain('id="finding-F-01"');
    expect(html).toContain('data-target="sec-findings"');
  });

  it('escapes malicious content in text fields', () => {
    const html = buildReportHtml({
      design: DEFAULT_DESIGN,
      project: {
        name: '<img src=x onerror=alert(1)>',
        client: '',
        scope: '',
        startDate: null,
        endDate: null,
        status: 'PLANNED',
      },
      sections: [],
      findings: [],
      meta: { generatedAt: new Date(), generatedBy: 'x' },
    });
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img');
  });
});
