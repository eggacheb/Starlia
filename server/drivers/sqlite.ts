// SQLite Driver Implementation (Async wrapper around sync bun:sqlite)
import { Database } from 'bun:sqlite';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { DatabaseDriver } from './types';

export class SQLiteDriver implements DatabaseDriver {
    private db: Database;

    constructor(dataDir: string) {
        // Ensure data directory exists
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
        }

        const dbPath = join(dataDir, 'starlia.db');
        this.db = new Database(dbPath);

        // Enable foreign keys
        this.db.run('PRAGMA foreign_keys = ON');

        console.log(`📦 SQLite database initialized at ${dbPath}`);
    }

    async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
        const stmt = this.db.query(sql);
        return stmt.all(...(params || [])) as T[];
    }

    async run(sql: string, params?: any[]): Promise<void> {
        this.db.run(sql, params || []);
    }

    async get<T = any>(sql: string, params?: any[]): Promise<T | null> {
        const stmt = this.db.query(sql);
        return (stmt.get(...(params || [])) as T) || null;
    }

    async close(): Promise<void> {
        this.db.close();
    }
}
