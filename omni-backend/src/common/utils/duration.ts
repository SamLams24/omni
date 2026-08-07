const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Parses "15m", "30d", "10s", "2h" into milliseconds. Throws on anything else. */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(
      `Invalid duration string: "${value}" (expected e.g. "15m", "30d")`,
    );
  }
  const amount = match[1];
  const unit = match[2];
  if (!amount || !unit) {
    throw new Error(
      `Invalid duration string: "${value}" (expected e.g. "15m", "30d")`,
    );
  }
  const unitMs = UNIT_MS[unit];
  if (!unitMs) {
    throw new Error(
      `Invalid duration string: "${value}" (expected e.g. "15m", "30d")`,
    );
  }
  return Number(amount) * unitMs;
}
