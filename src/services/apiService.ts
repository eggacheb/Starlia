// API Service - handles all backend API calls

const API_BASE = typeof window !== 'undefined' && window.location.port === '5173' ? 'http://localhost:3000' : '';

function getToken(): string | null {
    return localStorage.getItem('starlia_token');
}

export function setToken(token: string): void {
    localStorage.setItem('starlia_token', token);
}

export function removeToken(): void {
    localStorage.removeItem('starlia_token');
}

export function hasToken(): boolean {
    return !!getToken();
}

async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getToken();
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        if (response.status === 401) {
            removeToken();
            window.location.reload();
        }
        throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
}

// ==================== Auth ====================

export async function login(password: string): Promise<boolean> {
    try {
        const { token } = await apiRequest<{ token: string }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ password }),
        });
        setToken(token);
        return true;
    } catch {
        return false;
    }
}

export async function verifyToken(): Promise<boolean> {
    if (!hasToken()) return false;
    try {
        const { valid } = await apiRequest<{ valid: boolean }>('/api/auth/verify');
        return valid;
    } catch {
        removeToken();
        return false;
    }
}

// ==================== Settings ====================

export interface SettingsData {
    apiKey: string | null;
    settings: Record<string, any>;
}

export async function getSettings(): Promise<SettingsData> {
    return apiRequest<SettingsData>('/api/settings');
}

export async function saveSettings(data: SettingsData): Promise<void> {
    await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

// ==================== Conversations ====================

export interface ConversationData {
    id: string;
    title: string;
    created_at: number;
    updated_at: number;
}

export async function getConversations(): Promise<ConversationData[]> {
    return apiRequest<ConversationData[]>('/api/conversations');
}

export async function createConversation(id: string, title?: string): Promise<ConversationData> {
    return apiRequest<ConversationData>('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ id, title }),
    });
}

export async function deleteConversation(id: string): Promise<void> {
    await apiRequest(`/api/conversations/${id}`, { method: 'DELETE' });
}

export async function updateConversationTitle(id: string, title: string): Promise<void> {
    await apiRequest(`/api/conversations/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title }),
    });
}

// ==================== Messages ====================

export interface MessageData {
    id: string;
    role: 'user' | 'model';
    parts: any[];
    timestamp: number;
    isError?: boolean;
    thinkingDuration?: number;
}

export async function getMessages(conversationId: string): Promise<MessageData[]> {
    return apiRequest<MessageData[]>(`/api/conversations/${conversationId}/messages`);
}

export async function addMessage(conversationId: string, message: MessageData): Promise<void> {
    await apiRequest(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify(message),
    });
}

export async function updateMessage(
    messageId: string,
    data: { parts: any[]; isError?: boolean; thinkingDuration?: number }
): Promise<void> {
    await apiRequest(`/api/messages/${messageId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteMessage(messageId: string): Promise<void> {
    await apiRequest(`/api/messages/${messageId}`, { method: 'DELETE' });
}

// ==================== Images ====================

export interface ImageData {
    id: string;
    mime_type: string;
    thumbnail_data?: string;
    prompt?: string;
    timestamp: number;
    model_name?: string;
}

export async function getImages(): Promise<ImageData[]> {
    return apiRequest<ImageData[]>('/api/images');
}

export async function addImage(image: {
    id: string;
    mimeType: string;
    thumbnailData?: string;
    base64Data?: string;
    prompt?: string;
    timestamp: number;
    modelName?: string;
}): Promise<void> {
    await apiRequest('/api/images', {
        method: 'POST',
        body: JSON.stringify(image),
    });
}

export async function getImageData(id: string): Promise<string | null> {
    try {
        const { base64Data } = await apiRequest<{ base64Data: string }>(`/api/images/${id}/data`);
        return base64Data;
    } catch {
        return null;
    }
}

export async function deleteImage(id: string): Promise<void> {
    await apiRequest(`/api/images/${id}`, { method: 'DELETE' });
}

export async function clearImages(): Promise<void> {
    await apiRequest('/api/images', { method: 'DELETE' });
}
