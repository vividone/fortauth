import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { FORTAUTH_OPTIONS } from '../constants';
import type { FortAuthOptions } from '../interfaces';

@Injectable()
export class PasswordService {
  constructor(
    @Inject(FORTAUTH_OPTIONS) private readonly options: FortAuthOptions,
  ) {}

  async hash(password: string): Promise<string> {
    return argon2.hash(password);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  validateStrength(password: string): void {
    const policy = this.options.password;
    const errors: string[] = [];

    const minLength = policy?.minLength ?? 8;
    if (password.length < minLength) {
      errors.push(`at least ${minLength} characters`);
    }
    if ((policy?.requireLowercase ?? true) && !/[a-z]/.test(password)) {
      errors.push('a lowercase letter');
    }
    if ((policy?.requireUppercase ?? true) && !/[A-Z]/.test(password)) {
      errors.push('an uppercase letter');
    }
    if ((policy?.requireNumbers ?? true) && !/\d/.test(password)) {
      errors.push('a number');
    }
    if ((policy?.requireSpecialChars ?? true) && !/[^a-zA-Z0-9]/.test(password)) {
      errors.push('a special character');
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `Password must contain ${errors.join(', ')}`,
      );
    }
  }
}
