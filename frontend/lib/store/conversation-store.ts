'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { conversationApi, Conversation, Message } from '../api';

interface ConversationState {
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadConversations: () => Promise<void>;
  createConversation: (title?: string, topicId?: string) => Promise<Conversation>;
  selectConversation: (id: string | null) => void;
  updateConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  clearCurrentConversation: () => void;
  refreshConversations: () => Promise<void>;
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentConversationId: null,
      isLoading: false,
      error: null,

      loadConversations: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await conversationApi.list({ includeMetadata: true });
          if (response.success && response.data) {
            set({ conversations: response.data, isLoading: false });
          } else {
            set({ error: response.message || 'Failed to load conversations', isLoading: false });
          }
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to load conversations', 
            isLoading: false 
          });
        }
      },

      createConversation: async (title?: string, topicId?: string) => {
        try {
          const response = await conversationApi.create({ title, topicId });
          if (response.success && response.data) {
            const newConversation = response.data;
            set((state) => ({
              conversations: [newConversation, ...state.conversations],
              currentConversationId: newConversation.id,
            }));
            return newConversation;
          } else {
            throw new Error(response.message || 'Failed to create conversation');
          }
        } catch (error: any) {
          set({ error: error.message || 'Failed to create conversation' });
          throw error;
        }
      },

      selectConversation: (id: string | null) => {
        set({ currentConversationId: id });
      },

      updateConversation: async (id: string, title: string) => {
        try {
          const response = await conversationApi.update(id, { title });
          if (response.success && response.data) {
            set((state) => ({
              conversations: state.conversations.map((conv) =>
                conv.id === id ? response.data! : conv
              ),
            }));
          } else {
            throw new Error(response.message || 'Failed to update conversation');
          }
        } catch (error: any) {
          set({ error: error.message || 'Failed to update conversation' });
          throw error;
        }
      },

      deleteConversation: async (id: string) => {
        try {
          const response = await conversationApi.delete(id);
          if (response.success) {
            set((state) => {
              const newConversations = state.conversations.filter((conv) => conv.id !== id);
              const newCurrentId = 
                state.currentConversationId === id 
                  ? (newConversations.length > 0 ? newConversations[0].id : null)
                  : state.currentConversationId;
              return {
                conversations: newConversations,
                currentConversationId: newCurrentId,
              };
            });
          } else {
            throw new Error(response.message || 'Failed to delete conversation');
          }
        } catch (error: any) {
          set({ error: error.message || 'Failed to delete conversation' });
          throw error;
        }
      },

      clearCurrentConversation: () => {
        set({ currentConversationId: null });
      },

      refreshConversations: async () => {
        await get().loadConversations();
      },
    }),
    {
      name: 'conversation-storage',
      partialize: (state) => ({
        currentConversationId: state.currentConversationId,
      }),
    }
  )
);
