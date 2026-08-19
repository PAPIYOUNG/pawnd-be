import { createHash, randomBytes, randomInt } from 'crypto';

export function generateToken(size = 32): string {
  return randomBytes(size).toString('hex');
}

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
