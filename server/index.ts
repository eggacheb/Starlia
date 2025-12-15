import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { sign, verify } from 'hono/jwt';
import { streamSSE } from 'hono/streaming';
import { initDatabase, db, isMySQL } from './db';
import { streamGeminiResponse, generateContent, type ChatRequest } from './geminiProxy';

const app = new Hono();

// Environment variables
const PORT = parseInt(process.env.PORT || '3000');
const PASSWORD = process.env.PASSWORD || 'changeme';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomUUID();
const DATA_DIR = process.env.DATA_DIR || './data';
const DATABASE_URL = process.env.DATABASE_URL;

console.log(`🔧 Config: PORT=${PORT}, PASSWORD=${PASSWORD.slice(0, 3)}***, DATA_DIR=${DATA_DIR}`);
if (DATABASE_URL) {
    console.log(`🔧 DATABASE_URL is set, using MySQL`);
}

// Initialize database (async)
await initDatabase();

// CORS - 始终启用，因为前后端分离开发
app.use('/api/*', cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true,
}));

// ==================== Auth Routes ====================

app.post('/api/auth/login', async (c) => {
    const { password } = await c.req.json();

    if (password !== PASSWORD) {
        return c.json({ error: 'Invalid password' }, 401);
    }

    const token = await sign({ exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 }, JWT_SECRET);
    return c.json({ token });
});

app.get('/api/auth/verify', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ valid: false }, 401);
    }

    try {
        await verify(authHeader.slice(7), JWT_SECRET);
        return c.json({ valid: true });
    } catch {
        return c.json({ valid: false }, 401);
    }
});

// ==================== Protected Routes Middleware ====================

app.use('/api/*', async (c, next) => {
    // Skip auth routes and public routes
    if (c.req.path.startsWith('/api/auth/') || c.req.path === '/api/prompts') {
        return next();
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
        await verify(authHeader.slice(7), JWT_SECRET);
        return next();
    } catch {
        return c.json({ error: 'Unauthorized' }, 401);
    }
});

// ==================== Prompts Proxy Route ====================

const PROMPT_API_URL = 'https://raw.githubusercontent.com/glidea/banana-prompt-quicker/main/prompts.json';

app.get('/api/prompts', async (c) => {
    try {
        // 设置 30 秒超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(PROMPT_API_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`GitHub API responded with ${response.status}`);
        }
        const data = await response.json();
        return c.json(data);
    } catch (error) {
        console.error('Failed to fetch prompts:', error);
        return c.json({ error: 'Failed to fetch prompts' }, 500);
    }
});


// ==================== Settings Routes ====================

app.get('/api/settings', async (c) => {
    const row = await db.get('SELECT api_key, settings_json FROM settings WHERE id = 1') as any;
    if (!row) {
        return c.json({ apiKey: null, settings: {} });
    }
    return c.json({
        apiKey: row.api_key,
        settings: JSON.parse(row.settings_json || '{}')
    });
});

app.put('/api/settings', async (c) => {
    const { apiKey, settings } = await c.req.json();
    const now = Date.now();
    const settingsJson = JSON.stringify(settings);

    if (isMySQL()) {
        // MySQL syntax
        await db.run(`
            INSERT INTO settings (id, api_key, settings_json, updated_at)
            VALUES (1, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                api_key = VALUES(api_key),
                settings_json = VALUES(settings_json),
                updated_at = VALUES(updated_at)
        `, [apiKey, settingsJson, now]);
    } else {
        // SQLite syntax
        await db.run(`
            INSERT INTO settings (id, api_key, settings_json, updated_at)
            VALUES (1, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                api_key = excluded.api_key,
                settings_json = excluded.settings_json,
                updated_at = excluded.updated_at
        `, [apiKey, settingsJson, now]);
    }

    return c.json({ success: true });
});

// ==================== Conversations Routes ====================

app.get('/api/conversations', async (c) => {
    const rows = await db.query('SELECT * FROM conversations ORDER BY updated_at DESC');
    return c.json(rows);
});

app.post('/api/conversations', async (c) => {
    const { id, title } = await c.req.json();
    const now = Date.now();

    await db.run(
        'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
        [id, title || 'New Chat', now, now]
    );

    return c.json({ id, title: title || 'New Chat', created_at: now, updated_at: now });
});

app.delete('/api/conversations/:id', async (c) => {
    const id = c.req.param('id');
    await db.run('DELETE FROM conversations WHERE id = ?', [id]);
    return c.json({ success: true });
});

app.put('/api/conversations/:id', async (c) => {
    const id = c.req.param('id');
    const { title } = await c.req.json();
    const now = Date.now();

    await db.run('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', [title, now, id]);
    return c.json({ success: true });
});

// ==================== Messages Routes ====================

app.get('/api/conversations/:id/messages', async (c) => {
    const conversationId = c.req.param('id');
    const rows = await db.query(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
        [conversationId]
    ) as any[];

    return c.json(rows.map(row => ({
        id: row.id,
        role: row.role,
        parts: JSON.parse(row.parts_json),
        timestamp: row.timestamp,
        isError: !!row.is_error,
        thinkingDuration: row.thinking_duration
    })));
});

app.post('/api/conversations/:id/messages', async (c) => {
    const conversationId = c.req.param('id');
    const message = await c.req.json();

    await db.run(`
    INSERT INTO messages (id, conversation_id, role, parts_json, timestamp, is_error, thinking_duration)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
        message.id,
        conversationId,
        message.role,
        JSON.stringify(message.parts),
        message.timestamp,
        message.isError ? 1 : 0,
        message.thinkingDuration || null
    ]);

    // Update conversation updated_at
    await db.run('UPDATE conversations SET updated_at = ? WHERE id = ?', [Date.now(), conversationId]);

    return c.json({ success: true });
});

app.put('/api/messages/:id', async (c) => {
    const id = c.req.param('id');
    const { parts, isError, thinkingDuration } = await c.req.json();

    await db.run(`
    UPDATE messages SET parts_json = ?, is_error = ?, thinking_duration = ?
    WHERE id = ?
  `, [JSON.stringify(parts), isError ? 1 : 0, thinkingDuration || null, id]);

    return c.json({ success: true });
});

app.delete('/api/messages/:id', async (c) => {
    const id = c.req.param('id');
    await db.run('DELETE FROM messages WHERE id = ?', [id]);
    return c.json({ success: true });
});

// ==================== Image History Routes ====================

app.get('/api/images', async (c) => {
    const rows = await db.query(
        'SELECT id, mime_type, thumbnail_data, prompt, timestamp, model_name FROM image_history ORDER BY timestamp DESC'
    );
    return c.json(rows);
});

app.post('/api/images', async (c) => {
    const image = await c.req.json();

    // Insert metadata
    await db.run(`
    INSERT INTO image_history (id, mime_type, thumbnail_data, prompt, timestamp, model_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [image.id, image.mimeType, image.thumbnailData, image.prompt, image.timestamp, image.modelName]);

    // Insert image data if provided
    if (image.base64Data) {
        await db.run('INSERT INTO image_data (image_id, base64_data) VALUES (?, ?)', [image.id, image.base64Data]);
    }

    return c.json({ success: true });
});

app.get('/api/images/:id/data', async (c) => {
    const id = c.req.param('id');
    const row = await db.get('SELECT base64_data FROM image_data WHERE image_id = ?', [id]) as any;

    if (!row) {
        return c.json({ error: 'Not found' }, 404);
    }

    return c.json({ base64Data: row.base64_data });
});

app.delete('/api/images/:id', async (c) => {
    const id = c.req.param('id');
    await db.run('DELETE FROM image_history WHERE id = ?', [id]);
    // image_data will be deleted by CASCADE
    return c.json({ success: true });
});

app.delete('/api/images', async (c) => {
    await db.run('DELETE FROM image_history');
    return c.json({ success: true });
});

// ==================== Chat Routes (Gemini Proxy) ====================

// SSE streaming chat endpoint
app.post('/api/chat/stream', async (c) => {
    try {
        const request = await c.req.json() as ChatRequest;

        return streamSSE(c, async (stream) => {
            try {
                for await (const chunk of streamGeminiResponse(request)) {
                    await stream.writeSSE({
                        data: JSON.stringify(chunk),
                        event: 'message'
                    });
                }
                await stream.writeSSE({
                    data: 'done',
                    event: 'done'
                });
            } catch (error: any) {
                await stream.writeSSE({
                    data: JSON.stringify({ error: error.message }),
                    event: 'error'
                });
            }
        });
    } catch (error: any) {
        console.error('❌ Chat stream error:', error.message || error);
        return c.json({ error: error.message || 'Unknown error' }, 500);
    }
});

// Non-streaming chat endpoint
app.post('/api/chat', async (c) => {
    try {
        const request = await c.req.json() as ChatRequest;
        const result = await generateContent(request);
        return c.json(result);
    } catch (error: any) {
        console.error('❌ Chat error:', error.message || error);
        return c.json({ error: error.message || 'Unknown error' }, 500);
    }
});

// ==================== Static Files (Production) ====================

// 只在有 dist 目录时服务静态文件（生产模式）
try {
    const fs = await import('fs');
    if (fs.existsSync('./dist')) {
        app.use('/*', serveStatic({ root: './dist' }));
        app.get('*', serveStatic({ path: './dist/index.html' }));
    }
} catch {
    // 开发模式，不需要静态文件
}

// ==================== Start Server ====================

console.log(`🌟 Starlia server starting on port ${PORT}...`);

export default {
    port: PORT,
    fetch: app.fetch,
};
