import type { Content } from "@google/genai";
import { AppSettings, Part } from '../types';

// API Base URL (same as apiService)
const API_BASE = typeof window !== 'undefined' && window.location.port === '5173' ? 'http://localhost:3000' : '';

function getToken(): string | null {
  return localStorage.getItem('starlia_token');
}

// Helper to format API errors - directly return original error message
const formatGeminiError = (error: any): Error => {
  const errorMsg = error?.message || error?.toString() || "发生了未知错误";
  const newError = new Error(errorMsg);
  (newError as any).originalError = error;
  return newError;
};

// Helper to construct user content (for returning to caller)
const constructUserContent = (prompt: string, images: { base64Data: string; mimeType: string }[]): Content => {
  const userParts: any[] = [];

  images.forEach((img) => {
    userParts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64Data,
      },
    });
  });

  if (prompt.trim()) {
    userParts.push({ text: prompt });
  }

  return {
    role: "user",
    parts: userParts,
  };
};

// Stream Gemini response via backend SSE
export const streamGeminiResponse = async function* (
  apiKey: string,
  history: Content[],
  prompt: string,
  images: { base64Data: string; mimeType: string }[],
  settings: AppSettings,
  signal?: AbortSignal
) {
  const token = getToken();

  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({
      apiKey,
      history,
      prompt,
      images,
      settings
    }),
    signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw formatGeminiError(new Error(errorData.error || `HTTP ${response.status}`));
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          const eventType = line.slice(7).trim();
          if (eventType === 'done') {
            return;
          }
          if (eventType === 'error') {
            // Next data line will contain error
            continue;
          }
        }

        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === 'done') {
            return;
          }

          try {
            const parsed = JSON.parse(data);

            if (parsed.error) {
              throw formatGeminiError(new Error(parsed.error));
            }

            yield {
              userContent: constructUserContent(prompt, images),
              modelParts: parsed.modelParts as Part[]
            };
          } catch (e) {
            if ((e as Error).message?.includes('请求出错') || (e as Error).message?.includes('API Key')) {
              throw e;
            }
            // Ignore parse errors for incomplete data
          }
        }
      }
    }
  } catch (error) {
    if (signal?.aborted) {
      return;
    }
    console.error("SSE Stream Error:", error);
    throw formatGeminiError(error);
  } finally {
    reader.releaseLock();
  }
};

// Non-streaming Gemini response via backend
export const generateContent = async (
  apiKey: string,
  history: Content[],
  prompt: string,
  images: { base64Data: string; mimeType: string }[],
  settings: AppSettings,
  signal?: AbortSignal
) => {
  const token = getToken();

  try {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        apiKey,
        history,
        prompt,
        images,
        settings
      }),
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const result = await response.json();

    return {
      userContent: constructUserContent(prompt, images),
      modelParts: result.modelParts as Part[]
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw formatGeminiError(error);
  }
};
