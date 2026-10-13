// Advisory password strength for the sign up and reset screens.
// The SERVER enforces the real rules (min 10, max 128, not a common password). This only guides the user.

export const MIN_LENGTH = 10;
export const MAX_LENGTH = 128;

// Tiny sample list. The server must check against a much larger list of common passwords.
const COMMON = new Set([
  'password', 'password1', 'password123', '1234567890', '12345678910', 'qwertyuiop', 'qwerty12345',
  'iloveyou123', 'welcome123', 'admin12345', 'letmein123', 'abc1234567', 'passw0rd123', 'rotarota12',
  'football123', 'monkey12345', 'dragon12345', 'sunshine123', 'princess123', 'baseball123',
]);

export type StrengthLabel = 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
export type Check = { id: string; label: string; passed: boolean; required: boolean };
export type Strength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: StrengthLabel;
  checks: Check[];
  allowed: boolean; // true when the server's hard rules would pass
  hint: string;
};

function classCount(pw: string): number {
  let n = 0;
  if (/[a-z]/.test(pw)) n++;
  if (/[A-Z]/.test(pw)) n++;
  if (/[0-9]/.test(pw)) n++;
  if (/[^A-Za-z0-9]/.test(pw)) n++;
  return n;
}

function isRepetitive(pw: string): boolean {
  // "aaaaaaaaaa", "abababababab", "1234512345"
  if (/^(.)\1+$/.test(pw)) return true;
  for (const size of [2, 3, 4, 5]) {
    const unit = pw.slice(0, size);
    if (pw.length >= size * 2 && unit.repeat(Math.ceil(pw.length / size)).slice(0, pw.length) === pw) return true;
  }
  return false;
}

export function scorePassword(pw: string, email = ''): Strength {
  const len = pw.length;
  const classes = classCount(pw);
  const lower = pw.toLowerCase();
  const emailName = email.split('@')[0]?.toLowerCase() ?? '';
  const common = COMMON.has(lower) || isRepetitive(pw) || (emailName.length >= 4 && lower.includes(emailName));

  const checks: Check[] = [
    { id: 'length', label: `At least ${MIN_LENGTH} characters`, passed: len >= MIN_LENGTH, required: true },
    { id: 'common', label: 'Not a common or easy to guess password', passed: len > 0 && !common, required: true },
    { id: 'mix', label: 'Mix of letters, numbers, or symbols', passed: classes >= 2, required: false },
    { id: 'long', label: '14 or more characters is stronger', passed: len >= 14, required: false },
  ];

  let score: Strength['score'];
  if (len === 0 || len < MIN_LENGTH || len > MAX_LENGTH) score = 0;
  else if (common || classes < 2) score = 1;
  else if (len >= 20 || (len >= 16 && classes >= 3)) score = 4;
  else if (len >= 16 || (len >= 12 && classes >= 3)) score = 3;
  else score = 2;

  const labels: StrengthLabel[] = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const allowed = len >= MIN_LENGTH && len <= MAX_LENGTH && !common;

  let hint = '';
  if (len === 0) hint = `Use at least ${MIN_LENGTH} characters.`;
  else if (len > MAX_LENGTH) hint = `Use ${MAX_LENGTH} characters or fewer.`;
  else if (len < MIN_LENGTH) hint = `${MIN_LENGTH - len} more ${MIN_LENGTH - len === 1 ? 'character' : 'characters'} needed.`;
  else if (common) hint = 'This is easy to guess. Try a longer phrase that only you would know.';
  else if (classes < 2) hint = 'Add numbers, capital letters, or symbols, or make it longer.';
  else if (score < 4) hint = 'Longer is stronger. A short phrase of unrelated words works well.';
  else hint = 'Strong password.';

  return { score, label: labels[score], checks, allowed, hint };
}
