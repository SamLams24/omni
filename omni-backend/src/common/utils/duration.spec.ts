import { parseDurationMs } from './duration';

describe('parseDurationMs', () => {
  it('parses minutes', () => {
    expect(parseDurationMs('15m')).toBe(15 * 60_000);
  });

  it('parses days', () => {
    expect(parseDurationMs('30d')).toBe(30 * 86_400_000);
  });

  it('parses seconds and hours', () => {
    expect(parseDurationMs('10s')).toBe(10_000);
    expect(parseDurationMs('2h')).toBe(2 * 3_600_000);
  });

  it('throws on an invalid format', () => {
    expect(() => parseDurationMs('abc')).toThrow(/Invalid duration/);
    expect(() => parseDurationMs('15')).toThrow(/Invalid duration/);
    expect(() => parseDurationMs('15x')).toThrow(/Invalid duration/);
  });
});
