import fs from 'fs';
import path from 'path';
import { createLogger } from '@echo-lingo/logger';

const log = createLogger('DatabaseDriver');

export interface PreparedStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface IDatabaseDriver {
  exec(sql: string): void;
  prepare(sql: string): PreparedStatement;
  close(): void;
}

/**
 * Native Node.js SQLite driver using node:sqlite DatabaseSync (Node 22.5+)
 */
export class NodeSqliteDriver implements IDatabaseDriver {
  private db: any;

  constructor(filePath: string) {
    if (filePath !== ':memory:') {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // @ts-ignore
    const { DatabaseSync } = require('node:sqlite');
    this.db = new DatabaseSync(filePath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public prepare(sql: string): PreparedStatement {
    const stmt = this.db.prepare(sql);
    return {
      run: (...params: unknown[]) => stmt.run(...params),
      get: (...params: unknown[]) => stmt.get(...params),
      all: (...params: unknown[]) => stmt.all(...params),
    };
  }

  public close(): void {
    this.db.close();
  }
}

/**
 * Pure WebAssembly SQLite driver using sql.js (Works on any Node or Electron version)
 */
export class SqlJsDriver implements IDatabaseDriver {
  private db: any;
  private filePath: string;

  constructor(SQL: any, filePath: string) {
    this.filePath = filePath;
    if (filePath !== ':memory:') {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(filePath)) {
        try {
          const filebuffer = fs.readFileSync(filePath);
          this.db = new SQL.Database(filebuffer);
        } catch {
          this.db = new SQL.Database();
        }
      } else {
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }
  }

  private persist(): void {
    if (this.filePath && this.filePath !== ':memory:') {
      try {
        const data = this.db.export();
        fs.writeFileSync(this.filePath, Buffer.from(data));
      } catch (err) {
        log.error('Failed to save database:', err);
      }
    }
  }

  public exec(sql: string): void {
    this.db.exec(sql);
    this.persist();
  }

  public prepare(sql: string): PreparedStatement {
    const self = this;
    return {
      run: (...params: unknown[]) => {
        const normalized = params.map((p) => (p === undefined ? null : p));
        self.db.run(sql, normalized);
        self.persist();
        return { changes: self.db.getRowsModified(), lastInsertRowid: 0 };
      },
      get: (...params: unknown[]) => {
        const stmt = self.db.prepare(sql);
        const normalized = params.map((p) => (p === undefined ? null : p));
        stmt.bind(normalized);
        const hasRow = stmt.step();
        const row = hasRow ? stmt.getAsObject() : null;
        stmt.free();
        return row;
      },
      all: (...params: unknown[]) => {
        const stmt = self.db.prepare(sql);
        const normalized = params.map((p) => (p === undefined ? null : p));
        stmt.bind(normalized);
        const rows: unknown[] = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      },
    };
  }

  public close(): void {
    this.persist();
    this.db.close();
  }
}

/**
 * Universal database driver factory:
 * Uses node:sqlite if available, otherwise falls back to WebAssembly sql.js.
 */
export async function createDatabaseDriver(filePath: string): Promise<IDatabaseDriver> {
  try {
    // @ts-ignore
    const { DatabaseSync } = require('node:sqlite');
    if (DatabaseSync) {
      return new NodeSqliteDriver(filePath);
    }
  } catch {
    // node:sqlite not supported in this runtime (e.g. Electron Node 20)
  }

  // Fallback to sql.js
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  return new SqlJsDriver(SQL, filePath);
}
