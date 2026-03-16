import { Injectable, BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  validateStrength(password: string): void {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('at least 8 characters');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('a lowercase letter');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('an uppercase letter');
    }
    if (!/\d/.test(password)) {
      errors.push('a number');
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push('a special character');
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `Password must contain ${errors.join(', ')}`,
      );
    }
  }
}
