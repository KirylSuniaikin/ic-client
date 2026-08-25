// Characters that are easy to mis-key or mis-read when handed over verbally/on paper are
// excluded per task-spec.md Task 2c: the digit/letter pairs "0/O" and "1/l/I".
const EXCLUDED_CHARS = new Set(['0', 'O', '1', 'l', 'I']);

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    .split('')
    .filter(char => !EXCLUDED_CHARS.has(char))
    .join('');

const DEFAULT_LENGTH = 12;

export function generatePassword(length: number = DEFAULT_LENGTH): string {
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);

    let password = '';
    for (let i = 0; i < length; i++) {
        password += ALPHABET[randomValues[i] % ALPHABET.length];
    }
    return password;
}
