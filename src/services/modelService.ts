// Model Service - handles fetching available models from the API

export interface ModelInfo {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}

export interface ModelsResponse {
    data: ModelInfo[];
    object: string;
}

// Cache for models list
let cachedModels: ModelInfo[] | null = null;

/**
 * Fetch available models from the API
 * @param baseUrl - The base URL of the API (e.g., 'https://api.example.com/gemini')
 * @param apiKey - The API key for authorization
 * @param forceRefresh - If true, bypasses the cache and fetches fresh data
 */
export async function fetchModels(
    baseUrl: string,
    apiKey: string,
    forceRefresh = false
): Promise<ModelInfo[]> {
    // Return cached models if available and not forcing refresh
    if (cachedModels && !forceRefresh) {
        return cachedModels;
    }

    // Normalize base URL to get the root API endpoint
    // e.g., 'https://api.example.com/gemini' -> 'https://api.example.com'
    // e.g., 'https://api.example.com/v1' -> 'https://api.example.com'
    let normalizedUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes

    // Remove common API path suffixes to get the base domain
    const commonSuffixes = ['/gemini', '/v1', '/openai', '/api', '/chat'];
    for (const suffix of commonSuffixes) {
        if (normalizedUrl.endsWith(suffix)) {
            normalizedUrl = normalizedUrl.slice(0, -suffix.length);
            break;
        }
    }

    const response = await fetch(`${normalizedUrl}/v1/models`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': '*/*',
        },
    });

    if (!response.ok) {
        throw new Error(`获取模型列表失败: ${response.status} ${response.statusText}`);
    }

    const data: ModelsResponse = await response.json();
    cachedModels = data.data || [];

    return cachedModels;
}

/**
 * Clear the models cache
 */
export function clearModelsCache(): void {
    cachedModels = null;
}

/**
 * Get cached models without fetching
 */
export function getCachedModels(): ModelInfo[] | null {
    return cachedModels;
}
