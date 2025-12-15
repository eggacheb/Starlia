// MySQL Driver Implementation
// Uses mysql2/promise for async queries
import type { DatabaseDriver } from './types';

export class MySQLDriver implements DatabaseDriver {
    private pool: any;
    private config: any;

    constructor(connectionUrl: string) {
        // Parse mysql:// URL to mysql2 config
        // Format: mysql://user:pass@host:port/database
        const url = new URL(connectionUrl.replace('mysql://', 'http://'));

        this.config = {
            host: url.hostname,
            port: parseInt(url.port) || 3306,
            user: url.username,
            password: decodeURIComponent(url.password),
            database: url.pathname.slice(1), // Remove leading /
            waitForConnections: true,
            connectionLimit: 10,
        };

        // Use promise-based mysql2
        const mysql = require('mysql2/promise');
        this.pool = mysql.createPool(this.config);

        console.log(`📦 MySQL database connected to ${this.config.host}:${this.config.port}/${this.config.database}`);
    }

    async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
        try {
            const [rows] = await this.pool.execute(sql, params || []);
            return Array.isArray(rows) ? rows : [];
        } catch (error: any) {
            console.error('MySQL query error:', error.message);
            throw error;
        }
    }

    async run(sql: string, params?: any[]): Promise<void> {
        try {
            await this.pool.execute(sql, params || []);
        } catch (error: any) {
            // Ignore "table already exists" errors
            if (!error.message?.includes('already exists') &&
                !error.code?.includes('ER_TABLE_EXISTS')) {
                console.error('MySQL run error:', error.message);
                throw error;
            }
        }
    }

    async get<T = any>(sql: string, params?: any[]): Promise<T | null> {
        const results = await this.query<T>(sql, params);
        return results[0] || null;
    }

    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
        }
    }
}
