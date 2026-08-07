import {
  isValidFedaPayTransactionId,
  isTrustedFedaPayCheckoutUrl,
  normalizeTogoPhoneNumber,
} from './fedapay.util';

describe('isValidFedaPayTransactionId', () => {
  it('accepts a plain positive integer string', () => {
    expect(isValidFedaPayTransactionId('12345')).toBe(true);
  });

  it('rejects a leading zero, non-numeric value, or non-string', () => {
    expect(isValidFedaPayTransactionId('012345')).toBe(false);
    expect(isValidFedaPayTransactionId('abc')).toBe(false);
    expect(isValidFedaPayTransactionId(12345)).toBe(false);
  });
});

describe('normalizeTogoPhoneNumber', () => {
  it('strips the +228 country code down to 8 digits', () => {
    expect(normalizeTogoPhoneNumber('+22890123456')).toBe('90123456');
  });

  it('strips the 00228 international prefix', () => {
    expect(normalizeTogoPhoneNumber('0022890123456')).toBe('90123456');
  });

  it('accepts a bare 8-digit local number', () => {
    expect(normalizeTogoPhoneNumber('90123456')).toBe('90123456');
  });

  it('rejects a number of the wrong length', () => {
    expect(normalizeTogoPhoneNumber('123')).toBeNull();
  });

  it('rejects a non-string input', () => {
    expect(normalizeTogoPhoneNumber(90123456)).toBeNull();
  });
});

describe('isTrustedFedaPayCheckoutUrl', () => {
  it('accepts an https fedapay.com URL', () => {
    expect(
      isTrustedFedaPayCheckoutUrl('https://checkout.fedapay.com/abc'),
    ).toBe(true);
  });

  it('rejects a non-fedapay host, even if it contains "fedapay"', () => {
    expect(
      isTrustedFedaPayCheckoutUrl('https://fedapay.com.evil.test/abc'),
    ).toBe(false);
  });

  it('rejects a plain http URL', () => {
    expect(isTrustedFedaPayCheckoutUrl('http://fedapay.com/abc')).toBe(false);
  });

  it('rejects a malformed URL instead of throwing', () => {
    expect(isTrustedFedaPayCheckoutUrl('not a url')).toBe(false);
  });
});
