import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useUiStore } from '../store/useUiStore';
import { Key, X, Server, Save } from 'lucide-react';
import { clearModelsCache } from '../services/modelService';

interface ApiSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ isOpen, onClose }) => {
    const { apiKey, settings, setApiKey, updateSettings } = useAppStore();
    const { addToast } = useUiStore();

    const [inputKey, setInputKey] = useState(apiKey || '');
    const [endpoint, setEndpoint] = useState(settings.customEndpoint || '');

    // Sync with store when modal opens
    useEffect(() => {
        if (isOpen) {
            setInputKey(apiKey || '');
            setEndpoint(settings.customEndpoint || '');
        }
    }, [isOpen, apiKey, settings.customEndpoint]);

    const handleSave = () => {
        if (!inputKey.trim()) {
            addToast('请输入 API Key', 'error');
            return;
        }

        // Clear models cache if endpoint changed
        if (endpoint !== settings.customEndpoint) {
            clearModelsCache();
        }

        updateSettings({ customEndpoint: endpoint });
        setApiKey(inputKey.trim());
        addToast('设置已保存', 'success');
        onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && inputKey.trim()) {
            handleSave();
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 px-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6 transition-colors duration-200 animate-in zoom-in-95 fade-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="rounded-full bg-blue-50 dark:bg-blue-500/10 p-2.5 ring-1 ring-blue-200 dark:ring-blue-500/50">
                            <Key className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">API 设置</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <div className="space-y-4">
                    {/* Endpoint */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <Server className="h-4 w-4" />
                            接口地址
                        </label>
                        <input
                            type="text"
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.currentTarget.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                            placeholder="https://api.example.com/gemini"
                        />
                    </div>

                    {/* API Key */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <Key className="h-4 w-4" />
                            API Key
                        </label>
                        <input
                            type="password"
                            value={inputKey}
                            onChange={(e) => setInputKey(e.currentTarget.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                            placeholder="sk-..."
                            autoFocus
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!inputKey.trim()}
                            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="h-4 w-4" />
                            保存
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
