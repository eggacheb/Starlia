import { create } from 'zustand';
import { AppSettings, ChatMessage, Part, ImageHistoryItem, Conversation } from '../types';
import { createThumbnail } from '../utils/imageUtils';
import * as api from '../services/apiService';

interface AppState {
  // Auth
  isAuthenticated: boolean;
  isAuthChecking: boolean;

  // Data
  apiKey: string | null;
  settings: AppSettings;
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: ChatMessage[]; // Current conversation messages
  imageHistory: ImageHistoryItem[];

  // UI State
  isLoading: boolean;
  isSettingsOpen: boolean;
  inputText: string;
  installPrompt: any | null;
  isDataLoaded: boolean;

  // Auth Actions
  checkAuth: () => Promise<boolean>;
  logout: () => void;
  setAuthenticated: (value: boolean) => void;

  // Init
  loadData: () => Promise<void>;

  // Settings
  setInstallPrompt: (prompt: any) => void;
  setApiKey: (key: string) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;

  // Conversations
  createConversation: () => Promise<void>;
  switchConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;

  // Messages
  addMessage: (message: ChatMessage) => Promise<void>;
  updateLastMessage: (parts: Part[], isError?: boolean, thinkingDuration?: number) => void;
  deleteMessage: (id: string) => void;
  sliceMessages: (index: number) => void;
  clearHistory: () => void;

  // Images
  addImageToHistory: (image: ImageHistoryItem) => Promise<void>;
  deleteImageFromHistory: (id: string) => Promise<void>;
  clearImageHistory: () => Promise<void>;
  getImageData: (id: string) => Promise<string | null>;

  // UI
  setLoading: (loading: boolean) => void;
  setInputText: (text: string) => void;
  toggleSettings: () => void;
  removeApiKey: () => void;
}

const defaultSettings: AppSettings = {
  resolution: '1K',
  aspectRatio: 'Auto',
  useGrounding: false,
  enableThinking: true,
  streamResponse: true,
  customEndpoint: '',
  modelName: 'gemini-3-pro-image-preview',
  theme: 'system',
  isPro: true,
  sendWithModifier: false,
  enableCdnImageProcessing: true,
  enableArcade: false,
};

export const useAppStore = create<AppState>()((set, get) => ({
  // Auth
  isAuthenticated: false,
  isAuthChecking: true,

  // Data
  apiKey: null,
  settings: defaultSettings,
  conversations: [],
  activeConversationId: null,
  messages: [],
  imageHistory: [],

  // UI State
  isLoading: false,
  isSettingsOpen: window.innerWidth > 640,
  inputText: '',
  installPrompt: null,
  isDataLoaded: false,

  // ==================== Auth ====================

  checkAuth: async () => {
    set({ isAuthChecking: true });
    const valid = await api.verifyToken();
    set({ isAuthenticated: valid, isAuthChecking: false });
    return valid;
  },

  logout: () => {
    api.removeToken();
    set({
      isAuthenticated: false,
      apiKey: null,
      conversations: [],
      messages: [],
      imageHistory: [],
      activeConversationId: null,
      isDataLoaded: false
    });
  },

  setAuthenticated: (value) => set({ isAuthenticated: value }),

  // ==================== Init ====================

  loadData: async () => {
    if (get().isDataLoaded) return;

    try {
      // Load settings
      const settingsData = await api.getSettings();
      set({
        apiKey: settingsData.apiKey,
        settings: { ...defaultSettings, ...settingsData.settings }
      });

      // Load conversations
      const conversations = await api.getConversations();
      const formattedConversations: Conversation[] = conversations.map(c => ({
        id: c.id,
        title: c.title,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }));

      // Load images
      const images = await api.getImages();
      const formattedImages: ImageHistoryItem[] = images.map(img => ({
        id: img.id,
        mimeType: img.mime_type,
        thumbnailData: img.thumbnail_data,
        prompt: img.prompt || '',
        timestamp: img.timestamp,
        modelName: img.model_name
      }));

      set({
        conversations: formattedConversations,
        imageHistory: formattedImages,
        isDataLoaded: true
      });

      // Switch to first conversation if exists
      if (formattedConversations.length > 0) {
        await get().switchConversation(formattedConversations[0].id);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  },

  // ==================== Settings ====================

  setInstallPrompt: (prompt) => set({ installPrompt: prompt }),

  setApiKey: async (key) => {
    set({ apiKey: key });
    const { settings } = get();
    await api.saveSettings({ apiKey: key, settings });
  },

  updateSettings: async (newSettings) => {
    const { apiKey, settings } = get();
    const merged = { ...settings, ...newSettings };
    set({ settings: merged });
    await api.saveSettings({ apiKey, settings: merged });
  },

  // ==================== Conversations ====================

  createConversation: async () => {
    const id = crypto.randomUUID();
    const conv = await api.createConversation(id, 'New Chat');
    const conversation: Conversation = {
      id: conv.id,
      title: conv.title,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at
    };

    set(state => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: id,
      messages: []
    }));
  },

  switchConversation: async (id) => {
    if (get().activeConversationId === id) return;

    try {
      const messages = await api.getMessages(id);
      set({
        activeConversationId: id,
        messages
      });
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  },

  deleteConversation: async (id) => {
    await api.deleteConversation(id);

    const { conversations, activeConversationId } = get();
    const newConversations = conversations.filter(c => c.id !== id);

    set({ conversations: newConversations });

    // If deleted active conversation, switch to first available
    if (activeConversationId === id) {
      if (newConversations.length > 0) {
        await get().switchConversation(newConversations[0].id);
      } else {
        set({ activeConversationId: null, messages: [] });
      }
    }
  },

  updateConversationTitle: async (id, title) => {
    await api.updateConversationTitle(id, title);
    set(state => ({
      conversations: state.conversations.map(c =>
        c.id === id ? { ...c, title, updatedAt: Date.now() } : c
      )
    }));
  },

  // ==================== Messages ====================

  addMessage: async (message) => {
    const { activeConversationId, conversations } = get();

    // Create conversation if none exists
    if (!activeConversationId) {
      await get().createConversation();
    }

    const convId = get().activeConversationId!;

    set(state => ({ messages: [...state.messages, message] }));

    // Save to backend
    await api.addMessage(convId, message);

    // Update conversation title if it's the first user message
    if (message.role === 'user' && get().messages.length === 1) {
      const firstText = message.parts.find(p => p.text)?.text || 'New Chat';
      const title = firstText.slice(0, 30) + (firstText.length > 30 ? '...' : '');
      await get().updateConversationTitle(convId, title);
    }
  },

  updateLastMessage: (parts, isError = false, thinkingDuration) => {
    const messages = [...get().messages];

    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      messages[messages.length - 1] = {
        ...lastMessage,
        parts: [...parts],
        isError,
        ...(thinkingDuration !== undefined && { thinkingDuration })
      };

      set({ messages });

      // Don't update backend during streaming - will be saved when setLoading(false)
    }
  },

  deleteMessage: async (id) => {
    set(state => ({
      messages: state.messages.filter(m => m.id !== id)
    }));
    await api.deleteMessage(id);
  },

  sliceMessages: (index) => {
    const { messages } = get();
    const toDelete = messages.slice(index + 1);

    set({ messages: messages.slice(0, index + 1) });

    // Delete from backend
    toDelete.forEach(m => api.deleteMessage(m.id));
  },

  clearHistory: async () => {
    const { activeConversationId, messages } = get();
    set({ messages: [] });

    // Delete all messages from backend
    for (const m of messages) {
      await api.deleteMessage(m.id);
    }
  },

  // ==================== Images ====================

  addImageToHistory: async (image) => {
    let thumbnail = image.thumbnailData;
    if (!thumbnail && image.base64Data) {
      try {
        thumbnail = await createThumbnail(image.base64Data, image.mimeType);
      } catch (e) {
        console.error('Failed to create thumbnail', e);
      }
    }

    // Save to backend
    await api.addImage({
      id: image.id,
      mimeType: image.mimeType,
      thumbnailData: thumbnail,
      base64Data: image.base64Data,
      prompt: image.prompt,
      timestamp: image.timestamp,
      modelName: image.modelName
    });

    const newImageItem: ImageHistoryItem = {
      ...image,
      thumbnailData: thumbnail,
      base64Data: undefined
    };

    set(state => ({
      imageHistory: [newImageItem, ...state.imageHistory].slice(0, 100)
    }));
  },

  deleteImageFromHistory: async (id) => {
    await api.deleteImage(id);
    set(state => ({
      imageHistory: state.imageHistory.filter(img => img.id !== id)
    }));
  },

  clearImageHistory: async () => {
    await api.clearImages();
    set({ imageHistory: [] });
  },

  getImageData: async (id) => {
    return api.getImageData(id);
  },

  // ==================== UI ====================

  setLoading: async (loading) => {
    set({ isLoading: loading });

    // When loading finishes, save the last message to backend
    if (!loading) {
      const { messages, activeConversationId } = get();
      if (messages.length > 0 && activeConversationId) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === 'model') {
          // Update the model message in backend
          await api.updateMessage(lastMessage.id, {
            parts: lastMessage.parts,
            isError: lastMessage.isError,
            thinkingDuration: lastMessage.thinkingDuration
          });
        }
      }
    }
  },
  setInputText: (text) => set({ inputText: text }),
  toggleSettings: () => set(state => ({ isSettingsOpen: !state.isSettingsOpen })),
  removeApiKey: async () => {
    set({ apiKey: null });
    const { settings } = get();
    await api.saveSettings({ apiKey: null, settings });
  },
}));
