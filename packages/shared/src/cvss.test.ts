import { describe, expect, it } from 'vitest';
import { evaluateCvssVector, parseCvssVector, severityFromScore } from './cvss';

describe('CVSS v3.1 base score', () => {
  const cases: Array<[string, number, string]> = [
    ['CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', 9.8, 'CRITICAL'],
    ['CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H', 10.0, 'CRITICAL'],
    ['CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H', 7.8, 'HIGH'],
    ['CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N', 6.1, 'MEDIUM'],
    ['CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N', 3.1, 'LOW'],
    ['CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N', 0.0, 'INFO'],
    ['CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N', 6.5, 'MEDIUM'],
  ];

  it.each(cases)('%s → %d (%s)', (vector, score, severity) => {
    const result = evaluateCvssVector(vector);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(score);
    expect(result!.severity).toBe(severity);
  });

  it('accepts CVSS:3.0 and normalizes lowercase input', () => {
    const result = evaluateCvssVector('cvss:3.0/av:n/ac:l/pr:n/ui:n/s:u/c:h/i:h/a:h');
    expect(result?.score).toBe(9.8);
  });

  it('rejects invalid vectors', () => {
    expect(parseCvssVector('CVSS:3.1/AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toBeNull();
    expect(parseCvssVector('AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toBeNull();
    expect(parseCvssVector('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H')).toBeNull();
    expect(evaluateCvssVector('banana')).toBeNull();
  });

  it('maps severity thresholds correctly', () => {
    expect(severityFromScore(0)).toBe('INFO');
    expect(severityFromScore(0.1)).toBe('LOW');
    expect(severityFromScore(3.9)).toBe('LOW');
    expect(severityFromScore(4.0)).toBe('MEDIUM');
    expect(severityFromScore(6.9)).toBe('MEDIUM');
    expect(severityFromScore(7.0)).toBe('HIGH');
    expect(severityFromScore(8.9)).toBe('HIGH');
    expect(severityFromScore(9.0)).toBe('CRITICAL');
    expect(severityFromScore(10)).toBe('CRITICAL');
  });
});
