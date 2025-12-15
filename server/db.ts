// Database Initialization
// Supports both SQLite (default) and MySQL (via DATABASE_URL)

import type { DatabaseDriver } from './drivers/types';
import { SQLiteDriver } from './drivers/sqlite';

// Environment variables
const DATABASE_URL = process.env.DATABASE_URL;
const DATA_DIR = process.env.DATA_DIR || './data';

export let db: DatabaseDriver;

// Helper to check database type
export function isMySQL(): boolean {
  return !!DATABASE_URL;
}

export async function initDatabase() {
  if (DATABASE_URL) {
    // Use MySQL
    console.log('🔌 Using MySQL database...');
    const { MySQLDriver } = await import('./drivers/mysql');
    db = new MySQLDriver(DATABASE_URL);
  } else {
    // Use SQLite (default)
    console.log('🔌 Using SQLite database...');
    db = new SQLiteDriver(DATA_DIR);
  }

  // Initialize tables
  await initTables();

  // Run MySQL-specific migrations for existing tables
  if (isMySQL()) {
    await migrateMySQL();
  }
}

async function migrateMySQL() {
  // Alter existing TEXT columns to LONGTEXT if needed
  // These are safe to run multiple times - MySQL will just do nothing if already correct
  try {
    await db.run('ALTER TABLE settings MODIFY COLUMN settings_json LONGTEXT NOT NULL');
  } catch (e) { /* Column might already be LONGTEXT or table doesn't exist */ }

  try {
    await db.run('ALTER TABLE messages MODIFY COLUMN parts_json LONGTEXT NOT NULL');
  } catch (e) { /* Column might already be LONGTEXT or table doesn't exist */ }

  try {
    await db.run('ALTER TABLE image_history MODIFY COLUMN thumbnail_data LONGTEXT');
  } catch (e) { /* Column might already be LONGTEXT or table doesn't exist */ }

  try {
    await db.run('ALTER TABLE image_history MODIFY COLUMN prompt LONGTEXT');
  } catch (e) { /* Column might already be LONGTEXT or table doesn't exist */ }
}

async function initTables() {
  // Determine text type based on database
  // MySQL needs LONGTEXT for large JSON data, SQLite uses TEXT
  const LONGTEXT_TYPE = isMySQL() ? 'LONGTEXT' : 'TEXT';
  const TEXT_TYPE = isMySQL() ? 'TEXT' : 'TEXT'; // Same for both

  await db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY,
            api_key TEXT,
            settings_json ${LONGTEXT_TYPE} NOT NULL,
            updated_at BIGINT NOT NULL
        )
    `);

  await db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
            id VARCHAR(255) PRIMARY KEY,
            title TEXT NOT NULL,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL
        )
    `);

  await db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id VARCHAR(255) PRIMARY KEY,
            conversation_id VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL,
            parts_json ${LONGTEXT_TYPE} NOT NULL,
            timestamp BIGINT NOT NULL,
            is_error TINYINT DEFAULT 0,
            thinking_duration INTEGER,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
    `);

  await db.run(`
        CREATE TABLE IF NOT EXISTS image_history (
            id VARCHAR(255) PRIMARY KEY,
            mime_type VARCHAR(100) NOT NULL,
            thumbnail_data ${LONGTEXT_TYPE},
            prompt ${LONGTEXT_TYPE},
            timestamp BIGINT NOT NULL,
            model_name VARCHAR(255)
        )
    `);

  await db.run(`
        CREATE TABLE IF NOT EXISTS image_data (
            image_id VARCHAR(255) PRIMARY KEY,
            base64_data LONGTEXT NOT NULL,
            FOREIGN KEY (image_id) REFERENCES image_history(id) ON DELETE CASCADE
        )
    `);

  // Create indexes
  // MySQL doesn't support CREATE INDEX IF NOT EXISTS, so we use try-catch
  try {
    await db.run('CREATE INDEX idx_messages_conversation ON messages(conversation_id)');
  } catch (e) { /* Index may already exist */ }

  try {
    await db.run('CREATE INDEX idx_messages_timestamp ON messages(timestamp)');
  } catch (e) { /* Index may already exist */ }

  try {
    await db.run('CREATE INDEX idx_conversations_updated ON conversations(updated_at)');
  } catch (e) { /* Index may already exist */ }
}
