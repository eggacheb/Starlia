import { useAppStore } from '../store/useAppStore';
import { MessageSquarePlus, Trash2, X, MessageCircle } from 'lucide-react';

interface ChatHistoryPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ChatHistoryPanel({ isOpen, onClose }: ChatHistoryPanelProps) {
    const {
        conversations,
        activeConversationId,
        createConversation,
        switchConversation,
        deleteConversation
    } = useAppStore();

    const handleNewChat = () => {
        createConversation();
        onClose();
    };

    const handleSwitch = (id: string) => {
        switchConversation(id);
        onClose();
    };

    const handleDelete = (e: Event, id: string) => {
        e.stopPropagation();
        if (confirm('确定删除这个对话？')) {
            deleteConversation(id);
        }
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return '今天';
        if (days === 1) return '昨天';
        if (days < 7) return `${days}天前`;
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className={`fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-200 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <MessageCircle className="w-5 h-5" />
                        对话历史
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* New Chat Button */}
                <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                    <button
                        onClick={handleNewChat}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg"
                    >
                        <MessageSquarePlus className="w-5 h-5" />
                        新建对话
                    </button>
                </div>

                {/* Conversation List */}
                <div className="overflow-y-auto h-[calc(100%-8rem)]">
                    {conversations.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>暂无对话记录</p>
                            <p className="text-sm mt-1">点击上方按钮开始新对话</p>
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {conversations.map((conv) => (
                                <div
                                    key={conv.id}
                                    onClick={() => handleSwitch(conv.id)}
                                    className={`group p-3 rounded-xl cursor-pointer transition-all ${conv.id === activeConversationId
                                        ? 'bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 border-2 border-transparent'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-800 dark:text-white truncate">
                                                {conv.title}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                {formatDate(conv.updatedAt)}
                                            </p>
                                        </div>
                                        <button
                                            onClick={(e) => handleDelete(e, conv.id)}
                                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
