// Database Driver Interface
// Defines a unified ASYNC interface for database operations

export interface DatabaseDriver {
    /**
     * Execute a query and return all results
     */
    query<T = any>(sql: string, params?: any[]): Promise<T[]>;

    /**
     * Execute a statement (INSERT, UPDATE, DELETE)
     */
    run(sql: string, params?: any[]): Promise<void>;

    /**
     * Execute a query and return the first result
     */
    get<T = any>(sql: string, params?: any[]): Promise<T | null>;

    /**
     * Close the database connection
     */
    close(): Promise<void>;
}

export type DatabaseType = 'sqlite' | 'mysql';
