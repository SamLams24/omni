import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

type ErrorResponseBody = {
  statusCode: number;
  code: string;
  message: string;
  details: unknown[];
  requestId: string;
};

/**
 * Every unhandled error in the app is normalized to this shape. Stack
 * traces are logged server-side but never sent to the client, including
 * in development, so DTOs elsewhere can't accidentally rely on them.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? randomUUID();

    const { status, code, message, details } = this.normalize(exception);

    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      code,
      message,
      details,
      requestId,
    };
    response.status(status).json(body);
  }

  private normalize(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details: unknown[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null) {
        const record = payload as Record<string, unknown>;
        const rawMessage = record.message;
        return {
          status,
          code:
            typeof record.code === 'string'
              ? record.code
              : (HttpStatus[status] ?? 'ERROR'),
          message: Array.isArray(rawMessage)
            ? 'Validation failed'
            : typeof rawMessage === 'string'
              ? rawMessage
              : exception.message,
          details: Array.isArray(rawMessage) ? rawMessage : [],
        };
      }
      return {
        status,
        code: HttpStatus[status] ?? 'ERROR',
        message: String(payload),
        details: [],
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: [],
    };
  }
}
