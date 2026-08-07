/** Ported from apps/web/src/lib/fedapay.js -- already real, tested logic. */

export function isValidFedaPayTransactionId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d{0,29}$/.test(value);
}

export function normalizeTogoPhoneNumber(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  let digits = value.replace(/[^\d+]/g, '');
  if (digits.startsWith('+228')) digits = digits.slice(4);
  else if (digits.startsWith('00228')) digits = digits.slice(5);
  else if (digits.startsWith('228') && digits.length === 11)
    digits = digits.slice(3);

  return /^\d{8}$/.test(digits) ? digits : null;
}

export function isTrustedFedaPayCheckoutUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'fedapay.com' || url.hostname.endsWith('.fedapay.com'))
    );
  } catch {
    return false;
  }
}
