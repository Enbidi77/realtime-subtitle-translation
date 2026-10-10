import { app } from 'electron';
import path from 'path';
import { DatabaseRepository, IDatabaseDriver, createDatabaseDriver, runMigrations } from '@echo-lingo/database';

let repoInstance: DatabaseRepository | null = null;
let driverInstance: IDatabaseDriver | null = null;

export async function initDatabase(): Promise<DatabaseRepository> {
  if (repoInstance) return repoInstance;

  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'echolingo.sqlite');

  console.log(`[Database] Initializing SQLite database at: ${dbPath}`);
  driverInstance = await createDatabaseDriver(dbPath);
  runMigrations(driverInstance);
  repoInstance = new DatabaseRepository(driverInstance);

  return repoInstance;
}

export function getDatabase(): DatabaseRepository {
  if (!repoInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return repoInstance;
}

export function closeDatabase(): void {
  if (driverInstance) {
    try {
      driverInstance.close();
    } catch (e) {
      console.error('[Database] Error closing database:', e);
    }
    driverInstance = null;
    repoInstance = null;
  }
}
