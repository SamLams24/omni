import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Stable domain error codes -- the frontend maps these to translated,
 * user-facing messages (never the raw `message` string, which is for
 * logs/debugging). See docs/api/error-handling.md.
 */
export const ErrorCode = {
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  AUTH_USER_DISABLED: 'AUTH_USER_DISABLED',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',
  AUTH_LINK_VERIFICATION_REQUIRED: 'AUTH_LINK_VERIFICATION_REQUIRED',
  CSRF_TOKEN_INVALID: 'CSRF_TOKEN_INVALID',

  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  BUSINESS_NOT_FOUND: 'BUSINESS_NOT_FOUND',
  BUSINESS_ALREADY_CLAIMED: 'BUSINESS_ALREADY_CLAIMED',

  KYC_REQUIRED: 'KYC_REQUIRED',
  KYC_ALREADY_APPROVED: 'KYC_ALREADY_APPROVED',
  KYC_REQUEST_NOT_FOUND: 'KYC_REQUEST_NOT_FOUND',

  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_NOT_CANCELABLE: 'SUBSCRIPTION_NOT_CANCELABLE',

  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_ALREADY_PROCESSED: 'PAYMENT_ALREADY_PROCESSED',
  PAYMENT_PLAN_UNKNOWN: 'PAYMENT_PLAN_UNKNOWN',

  OSM_SERVICE_UNAVAILABLE: 'OSM_SERVICE_UNAVAILABLE',

  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Throw this instead of a bare HttpException so `code` always round-trips through HttpExceptionFilter. */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    code: ErrorCode,
    message: string,
    details: unknown[] = [],
  ) {
    super({ code, message, details }, status);
  }
}
