import { safeStorage } from 'electron';
import { getDatabase } from '@/database/db-instance.js';
import { createLogger, ILogger } from '@echo-lingo/logger';

export class CredentialsService {
  private static instance: CredentialsService | null = null;
  private readonly keyPrefix: string = 'cred_secret_';
  private readonly log: ILogger = createLogger('CredentialsService');

  public static getInstance(): CredentialsService {
    if (!CredentialsService.instance) {
      CredentialsService.instance = new CredentialsService();
    }
    return CredentialsService.instance;
  }

  /**
   * Save an API credential securely
   */
  public saveCredential(providerId: string, secret: string): void {
    const db = getDatabase();
    const trimmed = secret.trim();

    if (!trimmed) {
      this.deleteCredential(providerId);
      return;
    }

    let encryptedStr: string;
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const buffer = safeStorage.encryptString(trimmed);
      encryptedStr = 'enc:' + buffer.toString('base64');
    } else {
      // Fallback base64 encoding if OS keychain/DPAPI unavailable
      encryptedStr = 'b64:' + Buffer.from(trimmed).toString('base64');
    }

    db.setSetting(this.keyPrefix + providerId, encryptedStr);
  }

  /**
   * Retrieve decrypted API credential
   */
  public getCredential(providerId: string): string | null {
    const db = getDatabase();
    const stored = db.getSetting<string | null>(this.keyPrefix + providerId, null);
    if (!stored) return null;

    try {
      if (stored.startsWith('enc:') && safeStorage && safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(stored.slice(4), 'base64');
        return safeStorage.decryptString(buffer);
      } else if (stored.startsWith('b64:')) {
        return Buffer.from(stored.slice(4), 'base64').toString('utf-8');
      }
      return stored;
    } catch (err) {
      this.log.error(`Failed to decrypt credential for ${providerId}:`, err);
      return null;
    }
  }

  /**
   * Check if a credential exists without exposing it
   */
  public hasCredential(providerId: string): boolean {
    const cred = this.getCredential(providerId);
    return Boolean(cred && cred.length > 0);
  }

  /**
   * Delete credential
   */
  public deleteCredential(providerId: string): void {
    const db = getDatabase();
    db.setSetting(this.keyPrefix + providerId, null);
  }
}

export function getCredentialsService(): CredentialsService {
  return CredentialsService.getInstance();
}
