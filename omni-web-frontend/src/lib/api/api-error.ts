export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;
  readonly details: unknown;

  constructor(
    message: string,
    options: {
      status: number;
      code?: string | undefined;
      requestId?: string | undefined;
      details?: unknown;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code ?? "UNKNOWN_ERROR";
    this.requestId = options.requestId;
    this.details = options.details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

export class ApiNetworkError extends Error {
  constructor(cause: unknown) {
    super("Could not reach the OMNI API");
    this.name = "ApiNetworkError";
    this.cause = cause;
  }
}
