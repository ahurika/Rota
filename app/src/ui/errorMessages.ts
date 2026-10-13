// Turns server error codes into clear, human messages.
// Rules: say what happened, say what to do next, no blame, no codes, no jargon, no exclamation marks.
// The server sends { error: { code, message, requestId, fields? } }. The app never shows `message` directly,
// it shows the copy below. Add a row here whenever the server gets a new error code.

export type UxAction = 'retry' | 'login' | 'upgrade' | 'reset-password' | 'contact-owner' | 'update-app' | 'pay';
export type UxMessage = { title: string; message: string; action?: { label: string; kind: UxAction } };
type Params = { retryAfterSec?: number; seatLimit?: number; planName?: string };

const minutes = (sec = 60) => Math.max(1, Math.ceil(sec / 60));

const MESSAGES: Record<string, (p: Params) => UxMessage> = {
  NETWORK_ERROR: () => ({
    title: 'No connection',
    message: 'Check your internet connection and try again.',
    action: { label: 'Try again', kind: 'retry' },
  }),
  TIMEOUT: () => ({
    title: 'This is taking too long',
    message: 'The server did not answer in time. Try again in a moment.',
    action: { label: 'Try again', kind: 'retry' },
  }),
  INVALID_CREDENTIALS: () => ({
    title: 'Email or password is incorrect',
    message: 'Check both and try again, or reset your password.',
    action: { label: 'Reset password', kind: 'reset-password' },
  }),
  EMAIL_IN_USE: () => ({
    title: 'This email already has an account',
    message: 'Log in instead, or use a different email.',
    action: { label: 'Log in', kind: 'login' },
  }),
  INVALID_REFRESH: () => ({
    title: 'You have been logged out',
    message: 'For your security, log in again to continue.',
    action: { label: 'Log in', kind: 'login' },
  }),
  REFRESH_REUSED: () => ({
    title: 'You have been logged out on all devices',
    message: 'We saw a sign-in problem on your account. Log in again and consider changing your password.',
    action: { label: 'Log in', kind: 'login' },
  }),
  RATE_LIMITED: (p) => ({
    title: 'Too many attempts',
    message: `Wait ${minutes(p.retryAfterSec)} ${minutes(p.retryAfterSec) === 1 ? 'minute' : 'minutes'} and try again.`,
  }),
  FORBIDDEN: () => ({
    title: 'You cannot do this',
    message: 'Your role does not allow this action. Ask an owner or manager for help.',
    action: { label: 'Got it', kind: 'contact-owner' },
  }),
  NOT_FOUND: () => ({
    title: 'We could not find that',
    message: 'It may have been deleted or you may not have access to it.',
  }),
  SEAT_LIMIT_REACHED: (p) => ({
    title: 'No seats left',
    message: `Your ${p.planName ?? 'current'} plan allows ${p.seatLimit ?? 'a fixed number of'} people. Upgrade or add seats to invite more.`,
    action: { label: 'See plans', kind: 'upgrade' },
  }),
  BILLING_RESTRICTED: () => ({
    title: 'Your team is in view-only mode',
    message: 'The last payment failed. You can view shifts, but changes are paused until the owner pays.',
    action: { label: 'Fix payment', kind: 'pay' },
  }),
  IDEMPOTENCY_CONFLICT: () => ({
    title: 'Something changed',
    message: 'This request was already sent with different details. Start again.',
    action: { label: 'Try again', kind: 'retry' },
  }),
  REQUEST_IN_PROGRESS: () => ({
    title: 'Still working on it',
    message: 'Your request is being processed. Wait a few seconds before trying again.',
  }),
  INVITE_EXPIRED: () => ({
    title: 'This invite has expired',
    message: 'Ask the person who invited you to send a new one.',
  }),
  INVITE_USED: () => ({
    title: 'This invite was already used',
    message: 'If that was not you, ask for a new invite.',
  }),
  SWAP_NOT_ALLOWED: () => ({
    title: 'This swap is not possible',
    message: 'The shift may have changed or already has a pending request.',
  }),
  INVALID_CURSOR: () => ({
    title: 'Could not load more',
    message: 'Pull down to refresh the list.',
    action: { label: 'Refresh', kind: 'retry' },
  }),
  SERVICE_UNAVAILABLE: () => ({
    title: 'Rota is busy right now',
    message: 'Too many people are using it at once. Try again in a few seconds.',
    action: { label: 'Try again', kind: 'retry' },
  }),
  INTERNAL: () => ({
    title: 'Something went wrong on our side',
    message: 'Your data is safe. Try again, and contact support if it keeps happening.',
    action: { label: 'Try again', kind: 'retry' },
  }),
};

export function toUxMessage(code: string | undefined, params: Params = {}): UxMessage {
  const make = (code && MESSAGES[code]) || MESSAGES.INTERNAL;
  return make!(params);
}

// Field-level messages for validation errors. The server returns field codes, for example
// { fields: { email: 'EMAIL_INVALID', password: 'PASSWORD_TOO_SHORT' } }.
const FIELD_MESSAGES: Record<string, string> = {
  EMAIL_REQUIRED: 'Enter your email address.',
  EMAIL_INVALID: 'Enter a valid email address, like name@example.com.',
  PASSWORD_REQUIRED: 'Enter your password.',
  PASSWORD_TOO_SHORT: 'Use at least 10 characters.',
  PASSWORD_TOO_LONG: 'Use 128 characters or fewer.',
  PASSWORD_TOO_COMMON: 'This password is too easy to guess. Choose a different one.',
  NAME_REQUIRED: 'Enter a name.',
  SHIFT_END_BEFORE_START: 'End time must be after the start time.',
  SHIFT_OVERLAP: 'This person already has a shift at that time.',
  TIME_INVALID: 'Enter a time like 09:30.',
  TIMEZONE_INVALID: 'Choose a time zone from the list.',
};

export function fieldMessage(code: string): string {
  return FIELD_MESSAGES[code] ?? 'Check this field and try again.';
}
