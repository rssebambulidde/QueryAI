import { supabaseAdmin } from '../config/database';
import { Database } from '../types/database';
import logger from '../config/logger';
import { AppError, ValidationError, NotFoundError } from '../types/error';

export interface CreateCollectionInput {
  user_id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateCollectionInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface CollectionWithConversations extends Database.Collection {
  conversation_count?: number;
  conversations?: Database.Conversation[];
}

export class CollectionService {
  /**
   * Create a new collection
   */
  static async createCollection(input: CreateCollectionInput): Promise<Database.Collection> {
    try {
      // Validate input
      if (!input.name || input.name.trim().length === 0) {
        throw new ValidationError('Collection name is required');
      }

      if (input.name.length > 100) {
        throw new ValidationError('Collection name must be 100 characters or less');
      }

      const { data, error } = await supabaseAdmin
        .from('collections')
        .insert({
          user_id: input.user_id,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          color: input.color || '#f97316',
          icon: input.icon || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation
          throw new ValidationError('A collection with this name already exists');
        }
        logger.error('Error creating collection:', error);
        throw new AppError('Failed to create collection', 500);
      }

      logger.info('Collection created successfully', { collectionId: data.id, userId: input.user_id });
      return data;
    } catch (error: any) {
      if (error instanceof ValidationError || error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to create collection:', error);
      throw new AppError('Failed to create collection', 500);
    }
  }

  /**
   * Get a collection by ID
   */
  static async getCollection(collectionId: string, userId: string): Promise<Database.Collection> {
    try {
      const { data, error } = await supabaseAdmin
        .from('collections')
        .select('*')
        .eq('id', collectionId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('Collection not found');
        }
        logger.error('Error fetching collection:', error);
        throw new AppError('Failed to fetch collection', 500);
      }

      return data;
    } catch (error: any) {
      if (error instanceof NotFoundError || error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get collection:', error);
      throw new AppError('Failed to get collection', 500);
    }
  }

  /**
   * Get all collections for a user
   */
  static async getUserCollections(userId: string): Promise<CollectionWithConversations[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('collections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching collections:', error);
        throw new AppError('Failed to fetch collections', 500);
      }

      // Get conversation counts for each collection
      const collectionsWithCounts = await Promise.all(
        (data || []).map(async (collection) => {
          const { count, error: countError } = await supabaseAdmin
            .from('collection_conversations')
            .select('*', { count: 'exact', head: true })
            .eq('collection_id', collection.id);

          return {
            ...collection,
            conversation_count: countError ? 0 : (count || 0),
          };
        })
      );

      return collectionsWithCounts;
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get user collections:', error);
      throw new AppError('Failed to get user collections', 500);
    }
  }

  /**
   * Get a collection with its conversations
   */
  static async getCollectionWithConversations(
    collectionId: string,
    userId: string
  ): Promise<CollectionWithConversations> {
    try {
      const collection = await this.getCollection(collectionId, userId);

      // Get conversations in this collection
      const { data: conversationsData, error: conversationsError } = await supabaseAdmin
        .from('collection_conversations')
        .select(`
          conversation_id,
          added_at,
          conversations (
            id,
            user_id,
            topic_id,
            title,
            metadata,
            created_at,
            updated_at
          )
        `)
        .eq('collection_id', collectionId)
        .order('added_at', { ascending: false });

      if (conversationsError) {
        logger.error('Error fetching collection conversations:', conversationsError);
        throw new AppError('Failed to fetch collection conversations', 500);
      }

      const conversations = (conversationsData || []).map((cc: any) => cc.conversations).filter(Boolean);

      return {
        ...collection,
        conversation_count: conversations.length,
        conversations,
      };
    } catch (error: any) {
      if (error instanceof AppError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to get collection with conversations:', error);
      throw new AppError('Failed to get collection with conversations', 500);
    }
  }

  /**
   * Update a collection
   */
  static async updateCollection(
    collectionId: string,
    userId: string,
    updates: UpdateCollectionInput
  ): Promise<Database.Collection> {
    try {
      // Verify collection exists and belongs to user
      await this.getCollection(collectionId, userId);

      const updateData: any = {};
      if (updates.name !== undefined) {
        if (!updates.name || updates.name.trim().length === 0) {
          throw new ValidationError('Collection name cannot be empty');
        }
        if (updates.name.length > 100) {
          throw new ValidationError('Collection name must be 100 characters or less');
        }
        updateData.name = updates.name.trim();
      }
      if (updates.description !== undefined) {
        updateData.description = updates.description?.trim() || null;
      }
      if (updates.color !== undefined) {
        updateData.color = updates.color;
      }
      if (updates.icon !== undefined) {
        updateData.icon = updates.icon || null;
      }

      const { data, error } = await supabaseAdmin
        .from('collections')
        .update(updateData)
        .eq('id', collectionId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new ValidationError('A collection with this name already exists');
        }
        logger.error('Error updating collection:', error);
        throw new AppError('Failed to update collection', 500);
      }

      logger.info('Collection updated successfully', { collectionId });
      return data;
    } catch (error: any) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to update collection:', error);
      throw new AppError('Failed to update collection', 500);
    }
  }

  /**
   * Delete a collection
   */
  static async deleteCollection(collectionId: string, userId: string): Promise<void> {
    try {
      // Verify collection exists and belongs to user
      await this.getCollection(collectionId, userId);

      const { error } = await supabaseAdmin
        .from('collections')
        .delete()
        .eq('id', collectionId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error deleting collection:', error);
        throw new AppError('Failed to delete collection', 500);
      }

      logger.info('Collection deleted successfully', { collectionId });
    } catch (error: any) {
      if (error instanceof NotFoundError || error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to delete collection:', error);
      throw new AppError('Failed to delete collection', 500);
    }
  }

  /**
   * Add a conversation to a collection
   */
  static async addConversationToCollection(
    collectionId: string,
    conversationId: string,
    userId: string
  ): Promise<void> {
    try {
      // Verify collection exists and belongs to user
      await this.getCollection(collectionId, userId);

      // Verify conversation exists and belongs to user
      const { data: conversation, error: convError } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (convError || !conversation) {
        throw new NotFoundError('Conversation not found');
      }

      // Check if already in collection
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('collection_conversations')
        .select('id')
        .eq('collection_id', collectionId)
        .eq('conversation_id', conversationId)
        .single();

      if (existing) {
        // Already in collection, no error
        return;
      }

      const { error } = await supabaseAdmin
        .from('collection_conversations')
        .insert({
          collection_id: collectionId,
          conversation_id: conversationId,
        });

      if (error) {
        logger.error('Error adding conversation to collection:', error);
        throw new AppError('Failed to add conversation to collection', 500);
      }

      logger.info('Conversation added to collection', { collectionId, conversationId });
    } catch (error: any) {
      if (error instanceof NotFoundError || error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to add conversation to collection:', error);
      throw new AppError('Failed to add conversation to collection', 500);
    }
  }

  /**
   * Remove a conversation from a collection
   */
  static async removeConversationFromCollection(
    collectionId: string,
    conversationId: string,
    userId: string
  ): Promise<void> {
    try {
      // Verify collection exists and belongs to user
      await this.getCollection(collectionId, userId);

      const { error } = await supabaseAdmin
        .from('collection_conversations')
        .delete()
        .eq('collection_id', collectionId)
        .eq('conversation_id', conversationId);

      if (error) {
        logger.error('Error removing conversation from collection:', error);
        throw new AppError('Failed to remove conversation from collection', 500);
      }

      logger.info('Conversation removed from collection', { collectionId, conversationId });
    } catch (error: any) {
      if (error instanceof NotFoundError || error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to remove conversation from collection:', error);
      throw new AppError('Failed to remove conversation from collection', 500);
    }
  }

  /**
   * Search conversations within a collection
   */
  static async searchCollectionConversations(
    collectionId: string,
    userId: string,
    searchQuery: string
  ): Promise<Database.Conversation[]> {
    try {
      // Verify collection exists and belongs to user
      await this.getCollection(collectionId, userId);

      const { data, error } = await supabaseAdmin
        .from('collection_conversations')
        .select(`
          conversations (
            id,
            user_id,
            topic_id,
            title,
            metadata,
            created_at,
            updated_at
          )
        `)
        .eq('collection_id', collectionId)
        .ilike('conversations.title', `%${searchQuery}%`);

      if (error) {
        logger.error('Error searching collection conversations:', error);
        throw new AppError('Failed to search collection conversations', 500);
      }

      return (data || []).map((cc: any) => cc.conversations).filter(Boolean);
    } catch (error: any) {
      if (error instanceof NotFoundError || error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to search collection conversations:', error);
      throw new AppError('Failed to search collection conversations', 500);
    }
  }
}
