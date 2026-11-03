import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Compares two secrets, such as API keys or passwords, in constant time with `crypto.timingSafeEqual`.
 *
 * Both values are hashed with SHA-256 first, so the comparison takes the same time whatever their length and does
 * not reveal how many characters match.
 * @returns `true` when both values are equal.
 */
export function safeCompare(a: string | Buffer, b: string | Buffer): boolean {
    const digest = (value: string | Buffer) => createHash('sha256').update(value).digest();
    return timingSafeEqual(digest(a), digest(b));
}
