import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { fetchModels, ModelInfo, getCachedModels } from '../services/modelService';
import { ChevronDown, RefreshCw, Check, AlertCircle } from 'lucide-react';

export const ModelSelector: React.FC = () => {
    const { apiKey, settings, updateSettings } = useAppStore();
    const [isOpen, setIsOpen] = useState(false);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentModel = settings.modelName || 'gemini-3-pro-image-preview';

    // Shorten model name for display - only remove common prefixes
    const getDisplayName = (modelId: string) => {
        return modelId
            .replace(/^(google\/|Qwen\/|anthropic\/|openai\/)/, '');
    };

    const loadModels = useCallback(async (forceRefresh = false) => {
        if (!apiKey || !settings.customEndpoint) return;

        setIsLoading(true);
        setError(null);

        try {
            const fetchedModels = await fetchModels(
                settings.customEndpoint,
                apiKey,
                forceRefresh
            );
            setModels(fetchedModels);
            setHasFetched(true);
        } catch (err) {
            console.error('Failed to fetch models:', err);
            setError(err instanceof Error ? err.message : '获取模型列表失败');
        } finally {
            setIsLoading(false);
        }
    }, [apiKey, settings.customEndpoint]);

    // Load cached models on mount, or fetch if none cached
    useEffect(() => {
        const cached = getCachedModels();
        if (cached) {
            setModels(cached);
            setHasFetched(true);
        } else if (apiKey && settings.customEndpoint && !hasFetched) {
            loadModels();
        }
    }, [apiKey, settings.customEndpoint, hasFetched, loadModels]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectModel = (modelId: string) => {
        updateSettings({ modelName: modelId });
        setIsOpen(false);
    };

    const handleRefresh = (e: MouseEvent) => {
        e.stopPropagation();
        loadModels(true);
    };

    if (!apiKey) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
          bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300
          hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors
          border border-gray-200 dark:border-gray-700"
            >
                <span className="truncate max-w-[75px] sm:max-w-[200px]">{getDisplayName(currentModel)}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 max-h-80 overflow-hidden
          bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700
          z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                    {/* Header with Refresh */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            选择模型
                        </span>
                        <button
                            onClick={handleRefresh}
                            disabled={isLoading}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
                            title="刷新模型列表"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 text-gray-500 dark:text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="overflow-y-auto max-h-64">
                        {isLoading && models.length === 0 ? (
                            <div className="flex items-center justify-center py-8 text-gray-400">
                                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                                <span>加载中...</span>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                                <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
                                <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                                <button
                                    onClick={handleRefresh}
                                    className="mt-2 text-xs text-blue-500 hover:underline"
                                >
                                    点击重试
                                </button>
                            </div>
                        ) : models.length === 0 ? (
                            <div className="py-8 text-center text-gray-400 text-sm">
                                暂无可用模型
                            </div>
                        ) : (
                            <div className="py-1">
                                {models.map((model) => (
                                    <button
                                        key={model.id}
                                        onClick={() => handleSelectModel(model.id)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm
                      hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                      ${model.id === currentModel ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className={`truncate font-medium ${model.id === currentModel
                                                ? 'text-blue-600 dark:text-blue-400'
                                                : 'text-gray-700 dark:text-gray-300'
                                                }`}>
                                                {getDisplayName(model.id)}
                                            </p>
                                            <p className="text-xs text-gray-400 truncate">{model.id}</p>
                                        </div>
                                        {model.id === currentModel && (
                                            <Check className="h-4 w-4 text-blue-500 ml-2 flex-shrink-0" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
