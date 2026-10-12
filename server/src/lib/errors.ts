export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SEAT_LIMIT_REACHED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'BILLING_RESTRICTED'
  | 'INVALID_CURSOR'
  | 'SWAP_ALREADY_PENDING'
  | 'INTERNAL_SERVER_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: ErrorCode, statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
