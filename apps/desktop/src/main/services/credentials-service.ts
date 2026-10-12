import { safeStorage } from 'electron';
import { getDatabase } from '@/database/db-instance.js';

export class CredentialsService {
  private static readonly KEY_PREFIX = 'cred_secret_';

  /**
   * Save an API credential securely
   */
  public static saveCredential(providerId: string, secret: string): void {
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

    db.setSetting(this.KEY_PREFIX + providerId, encryptedStr);
  }

  /**
   * Retrieve decrypted API credential
   */
  public static getCredential(providerId: string): string | null {
    const db = getDatabase();
    const stored = db.getSetting<string | null>(this.KEY_PREFIX + providerId, null);
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
      console.error(`Failed to decrypt credential for ${providerId}:`, err);
      return null;
    }
  }

  /**
   * Check if a credential exists without exposing it
   */
  public static hasCredential(providerId: string): boolean {
    const cred = this.getCredential(providerId);
    return Boolean(cred && cred.length > 0);
  }

  /**
   * Delete credential
   */
  public static deleteCredential(providerId: string): void {
    const db = getDatabase();
    db.setSetting(this.KEY_PREFIX + providerId, null);
  }
}
