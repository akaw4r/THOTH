import { Injectable } from '@nestjs/common';
import { decryptBuffer, decryptString, encryptBuffer, encryptString } from '@thoth/shared/node';
import { ConfigService } from '../config/config.service';

/** Wrapper around the AES-256-GCM primitives using the application key. */
@Injectable()
export class CryptoService {
  constructor(private readonly config: ConfigService) {}

  encryptString(plaintext: string): string {
    return encryptString(plaintext, this.config.encryptionKey);
  }

  decryptString(payload: string): string {
    return decryptString(payload, this.config.encryptionKey);
  }

  encryptBuffer(plaintext: Buffer): Buffer {
    return encryptBuffer(plaintext, this.config.encryptionKey);
  }

  decryptBuffer(payload: Buffer): Buffer {
    return decryptBuffer(payload, this.config.encryptionKey);
  }
}
