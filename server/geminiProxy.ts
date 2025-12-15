import { GoogleGenAI, type Content, type Part as SDKPart } from "@google/genai";

// Types (shared with frontend)
export interface AppSettings {
    resolution: '1K' | '2K' | '4K';
    aspectRatio: 'Auto' | '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
    useGrounding: boolean;
    enableThinking: boolean;
    streamResponse: boolean;
    customEndpoint?: string;
    modelName?: string;
    isPro: boolean;
    enableCdnImageProcessing: boolean;
    resolutionModelMap?: Partial<Record<'1K' | '2K' | '4K', string>>;
}

export interface Part {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
    thought?: boolean;
    thoughtSignature?: string;
}

export interface ChatRequest {
    apiKey: string;
    history: Content[];
    prompt: string;
    images: { base64Data: string; mimeType: string }[];
    settings: AppSettings;
}

// Helper function to get model based on resolution
const getModelByResolution = (settings: AppSettings): string => {
    if (settings.isPro && settings.resolutionModelMap?.[settings.resolution]) {
        return settings.resolutionModelMap[settings.resolution]!;
    }
    return settings.modelName || "gemini-3-pro-image-preview";
};

// Helper to construct user content
const constructUserContent = (prompt: string, images: { base64Data: string; mimeType: string }[]): Content => {
    const userParts: SDKPart[] = [];

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

// Helper to format Gemini API errors - directly return original error message
const formatGeminiError = (error: any): string => {
    return error?.message || error?.toString() || "发生了未知错误";
};

// Stream Gemini response as async generator
export async function* streamGeminiResponse(request: ChatRequest) {
    const { apiKey, history, prompt, images, settings } = request;

    const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { baseUrl: settings.customEndpoint || undefined }
    });

    // Filter out thought parts from history
    const cleanHistory = history.map(item => {
        if (item.role === 'model') {
            return {
                ...item,
                parts: item.parts.filter((p: any) => !p.thought)
            };
        }
        return item;
    }).filter(item => item.parts.length > 0);

    const currentUserContent = constructUserContent(prompt, images);
    const contentsPayload = [...cleanHistory, currentUserContent];

    try {
        const responseStream = await ai.models.generateContentStream({
            model: getModelByResolution(settings),
            contents: contentsPayload,
            config: {
                ...(settings.isPro ? {
                    imageConfig: {
                        imageSize: settings.resolution,
                        ...(settings.aspectRatio !== 'Auto' ? { aspectRatio: settings.aspectRatio } : {}),
                    },
                    tools: settings.useGrounding ? [{ googleSearch: {} }] : [],
                } : {}),
                responseModalities: ["TEXT", "IMAGE"],
                ...(settings.isPro && settings.enableThinking ? {
                    thinkingConfig: {
                        includeThoughts: true,
                    }
                } : {}),
            },
        });

        let currentParts: Part[] = [];

        for await (const chunk of responseStream) {
            const candidates = chunk.candidates;
            if (!candidates || candidates.length === 0) continue;

            const newParts = candidates[0].content?.parts || [];

            // Process new parts
            for (const part of newParts) {
                const signature = (part as any).thoughtSignature;
                const isThought = !!(part as any).thought;

                if (part.text !== undefined) {
                    // Find last text part with same thought state to append to
                    const lastPart = currentParts[currentParts.length - 1];
                    if (
                        lastPart &&
                        lastPart.text !== undefined &&
                        !!lastPart.thought === isThought
                    ) {
                        lastPart.text += part.text;
                        if (signature) {
                            lastPart.thoughtSignature = signature;
                        }
                    } else {
                        currentParts.push({
                            text: part.text,
                            thought: isThought,
                            ...(signature && { thoughtSignature: signature })
                        });
                    }
                } else if (part.inlineData) {
                    currentParts.push({
                        inlineData: {
                            mimeType: part.inlineData.mimeType || 'image/png',
                            data: part.inlineData.data || ''
                        },
                        thought: isThought,
                        ...(signature && { thoughtSignature: signature })
                    });
                }
            }

            yield {
                userContent: currentUserContent,
                modelParts: currentParts
            };
        }
    } catch (error: any) {
        console.error("Gemini API Stream Error:", formatGeminiError(error));
        throw new Error(formatGeminiError(error));
    }
}

// Non-streaming Gemini response
export async function generateContent(request: ChatRequest) {
    const { apiKey, history, prompt, images, settings } = request;

    const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { baseUrl: settings.customEndpoint || undefined }
    });

    // Filter out thought parts from history
    const cleanHistory = history.map(item => {
        if (item.role === 'model') {
            return {
                ...item,
                parts: item.parts.filter((p: any) => !p.thought)
            };
        }
        return item;
    }).filter(item => item.parts.length > 0);

    const currentUserContent = constructUserContent(prompt, images);
    const contentsPayload = [...cleanHistory, currentUserContent];

    try {
        const response = await ai.models.generateContent({
            model: getModelByResolution(settings),
            contents: contentsPayload,
            config: {
                ...(settings.isPro ? {
                    imageConfig: {
                        imageSize: settings.resolution,
                        ...(settings.aspectRatio !== 'Auto' ? { aspectRatio: settings.aspectRatio } : {}),
                    },
                    tools: settings.useGrounding ? [{ googleSearch: {} }] : [],
                } : {}),
                responseModalities: ["TEXT", "IMAGE"],
                ...(settings.isPro && settings.enableThinking ? {
                    thinkingConfig: {
                        includeThoughts: true,
                    }
                } : {}),
            },
        });

        const candidate = response.candidates?.[0];
        if (!candidate || !candidate.content || !candidate.content.parts) {
            throw new Error("No content generated.");
        }

        const modelParts: Part[] = candidate.content.parts.map((part: SDKPart) => {
            const signature = (part as any).thoughtSignature;
            const isThought = !!(part as any).thought;

            if (part.text !== undefined) {
                return {
                    text: part.text,
                    thought: isThought,
                    ...(signature && { thoughtSignature: signature })
                };
            } else if (part.inlineData) {
                return {
                    inlineData: {
                        mimeType: part.inlineData.mimeType || 'image/png',
                        data: part.inlineData.data || ''
                    },
                    thought: isThought,
                    ...(signature && { thoughtSignature: signature })
                };
            }
            return null;
        }).filter(Boolean) as Part[];

        return {
            userContent: currentUserContent,
            modelParts
        };

    } catch (error: any) {
        console.error("Gemini API Error:", formatGeminiError(error));
        throw new Error(formatGeminiError(error));
    }
}
