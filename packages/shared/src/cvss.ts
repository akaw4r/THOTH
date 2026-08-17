import type { Severity } from './constants';

/**
 * CVSS v3.1 (Base Score) calculator, per the FIRST specification
 * https://www.first.org/cvss/v3.1/specification-document
 */

export interface CvssMetrics {
  AV: 'N' | 'A' | 'L' | 'P';
  AC: 'L' | 'H';
  PR: 'N' | 'L' | 'H';
  UI: 'N' | 'R';
  S: 'U' | 'C';
  C: 'H' | 'L' | 'N';
  I: 'H' | 'L' | 'N';
  A: 'H' | 'L' | 'N';
}

const AV_WEIGHT = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 } as const;
const AC_WEIGHT = { L: 0.77, H: 0.44 } as const;
const PR_WEIGHT_UNCHANGED = { N: 0.85, L: 0.62, H: 0.27 } as const;
const PR_WEIGHT_CHANGED = { N: 0.85, L: 0.68, H: 0.5 } as const;
const UI_WEIGHT = { N: 0.85, R: 0.62 } as const;
const CIA_WEIGHT = { H: 0.56, L: 0.22, N: 0 } as const;

const VECTOR_RE =
  /^CVSS:3\.[01]\/AV:([NALP])\/AC:([LH])\/PR:([NLH])\/UI:([NR])\/S:([UC])\/C:([HLN])\/I:([HLN])\/A:([HLN])$/;

/** Roundup per Appendix A of the specification (avoids floating-point errors). */
function roundup(input: number): number {
  const int = Math.round(input * 100000);
  if (int % 10000 === 0) {
    return int / 100000;
  }
  return (Math.floor(int / 10000) + 1) / 10;
}

export function parseCvssVector(vector: string): CvssMetrics | null {
  const m = VECTOR_RE.exec(vector.trim().toUpperCase());
  if (!m) return null;
  return {
    AV: m[1] as CvssMetrics['AV'],
    AC: m[2] as CvssMetrics['AC'],
    PR: m[3] as CvssMetrics['PR'],
    UI: m[4] as CvssMetrics['UI'],
    S: m[5] as CvssMetrics['S'],
    C: m[6] as CvssMetrics['C'],
    I: m[7] as CvssMetrics['I'],
    A: m[8] as CvssMetrics['A'],
  };
}

export function cvssBaseScore(metrics: CvssMetrics): number {
  const iss =
    1 - (1 - CIA_WEIGHT[metrics.C]) * (1 - CIA_WEIGHT[metrics.I]) * (1 - CIA_WEIGHT[metrics.A]);

  const impact =
    metrics.S === 'U' ? 6.42 * iss : 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15);

  const prWeight =
    metrics.S === 'U' ? PR_WEIGHT_UNCHANGED[metrics.PR] : PR_WEIGHT_CHANGED[metrics.PR];

  const exploitability =
    8.22 * AV_WEIGHT[metrics.AV] * AC_WEIGHT[metrics.AC] * prWeight * UI_WEIGHT[metrics.UI];

  if (impact <= 0) return 0;

  if (metrics.S === 'U') {
    return roundup(Math.min(impact + exploitability, 10));
  }
  return roundup(Math.min(1.08 * (impact + exploitability), 10));
}

export function severityFromScore(score: number): Severity {
  if (score <= 0) return 'INFO';
  if (score < 4) return 'LOW';
  if (score < 7) return 'MEDIUM';
  if (score < 9) return 'HIGH';
  return 'CRITICAL';
}

export interface CvssResult {
  score: number;
  severity: Severity;
  metrics: CvssMetrics;
}

/** Returns null if the vector is invalid. */
export function evaluateCvssVector(vector: string): CvssResult | null {
  const metrics = parseCvssVector(vector);
  if (!metrics) return null;
  const score = cvssBaseScore(metrics);
  return { score, severity: severityFromScore(score), metrics };
}
