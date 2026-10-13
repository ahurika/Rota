import { describe, it, expect } from 'vitest';
import { scorePassword } from '../src/ui/passwordStrength';

describe('Password Strength Advisory Meter', () => {
  it('correctly evaluates the 12 reference test cases from the UI Spec', () => {
    // 1. Empty string
    const empty = scorePassword('');
    expect(empty.score).toBe(0);
    expect(empty.label).toBe('Too short');
    expect(empty.allowed).toBe(false);

    // 2. short1 (too short)
    const short = scorePassword('short1');
    expect(short.score).toBe(0);
    expect(short.label).toBe('Too short');
    expect(short.allowed).toBe(false);

    // 3. password123 (common)
    const common = scorePassword('password123');
    expect(common.score).toBe(1);
    expect(common.label).toBe('Weak');
    expect(common.allowed).toBe(false);

    // 4. aaaaaaaaaaaa (repetitive single char)
    const rep1 = scorePassword('aaaaaaaaaaaa');
    expect(rep1.score).toBe(1);
    expect(rep1.label).toBe('Weak');
    expect(rep1.allowed).toBe(false);

    // 5. abababababab (repetitive unit)
    const rep2 = scorePassword('abababababab');
    expect(rep2.score).toBe(1);
    expect(rep2.label).toBe('Weak');
    expect(rep2.allowed).toBe(false);

    // 6. lowercaseonly (allowed by server, but only one character type so weak)
    const lowerOnly = scorePassword('lowercaseonly');
    expect(lowerOnly.score).toBe(1);
    expect(lowerOnly.label).toBe('Weak');
    expect(lowerOnly.allowed).toBe(true);

    // 7. Contains email username
    const withEmail = scorePassword('kate.ahurika99', 'kate.ahurika@x.com');
    expect(withEmail.score).toBe(1);
    expect(withEmail.label).toBe('Weak');
    expect(withEmail.allowed).toBe(false);

    // 8. Blue7table (10 chars, 3 classes -> fair)
    const fair = scorePassword('Blue7table');
    expect(fair.score).toBe(2);
    expect(fair.label).toBe('Fair');
    expect(fair.allowed).toBe(true);

    // 9. Blue7tableWalks (15 chars, 3 classes -> good)
    const good = scorePassword('Blue7tableWalks');
    expect(good.score).toBe(3);
    expect(good.label).toBe('Good');
    expect(good.allowed).toBe(true);

    // 10. correct horse battery (21 chars, spaces -> strong)
    const strong1 = scorePassword('correct horse battery');
    expect(strong1.score).toBe(4);
    expect(strong1.label).toBe('Strong');
    expect(strong1.allowed).toBe(true);

    // 11. Tr0ub4dor&3xyz!! (17 chars, 4 classes -> strong)
    const strong2 = scorePassword('Tr0ub4dor&3xyz!!');
    expect(strong2.score).toBe(4);
    expect(strong2.label).toBe('Strong');
    expect(strong2.allowed).toBe(true);

    // 12. 129 characters (> 128 max length)
    const tooLong = scorePassword('a'.repeat(129));
    expect(tooLong.score).toBe(0);
    expect(tooLong.label).toBe('Too short'); // > MAX_LENGTH resets score to 0
    expect(tooLong.allowed).toBe(false);
  });
});
