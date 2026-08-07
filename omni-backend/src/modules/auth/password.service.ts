import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id password hashing. Uses @node-rs/argon2 (napi-rs), not the
 * `argon2` npm package -- see docs/setup/local-development.md for why
 * (the classic native binding segfaults in this environment). Both
 * default to Argon2id.
 */
@Injectable()
export class PasswordService {
  hash(plainPassword: string): Promise<string> {
    return hash(plainPassword);
  }

  verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    return verify(passwordHash, plainPassword);
  }
}
