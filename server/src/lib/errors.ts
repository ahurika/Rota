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
  | 'INVALID_SIGNATURE'
  | 'INVALID_JSON'
  | 'SEATS_BELOW_OCCUPANCY'
  | 'SEATS_OUT_OF_RANGE'
  | 'INVALID_PLAN'
  | 'INTERNAL_SERVER_ERROR';

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    arg1: ErrorCode | number | string,
    arg2: ErrorCode | number | string,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';

    if (typeof arg1 === 'number') {
      this.statusCode = arg1;
      this.code = String(arg2);
    } else if (typeof arg2 === 'number') {
      this.code = String(arg1);
      this.statusCode = arg2;
    } else {
      this.code = String(arg1);
      this.statusCode = 500;
    }

    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
