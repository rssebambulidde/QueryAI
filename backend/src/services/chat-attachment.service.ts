/**
 * Chat Attachment Service
 *
 * Handles the upload-then-reference pattern for inline chat attachments.
 * On first upload: stores the file in Supabase Storage, extracts text,
 * and saves metadata + extracted text in the chat_attachments table.
 * On follow-ups: resolves fileId references to extracted text without
 * re-sending base64 payloads.
 */

import { supabaseAdmin } from '../config/database';
import config from '../config/env';
import logger from '../config/logger';
import { AppError, ValidationError, NotFoundError } from '../types/error';

const STORAGE_BUCKET = 'chat-attachments';
const MAX_EXTRACTED_TEXT = 12_000; // chars — matches pipeline smart-truncation limit

export interface ChatAttachmentRow {
  id: string;
  user_id: string;
  conversation_id: string | null;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string | null;
  extracted_text: string | null;
  extraction_status: 'pending' | 'success' | 'truncated' | 'failed';
  extraction_chars: number;
  created_at: string;
}

export interface UploadResult {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  extractionStatus: 'success' | 'truncated' | 'failed';
  extractionChars: number;
  extractionReason?: string;
}

export class ChatAttachmentService {
  /**
   * Ensure the storage bucket exists (creates it if not).
   */
  private static async ensureBucket(): Promise<void> {
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const existing = buckets?.find((b) => b.name === STORAGE_BUCKET);
      if (!existing) {
        await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, {
          public: false, // private — accessed via service role only
          fileSizeLimit: 52_428_800, // 50 MB
        });
        logger.info('Created storage bucket', { bucket: STORAGE_BUCKET });
      }
    } catch (err: any) {
      logger.warn('Bucket check/create failed (non-fatal)', { error: err.message });
    }
  }

  /**
   * Upload a file, extract text, and store in the chat_attachments table.
   * Returns the attachment ID and extraction result.
   */
  static async upload(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    conversationId?: string,
  ): Promise<UploadResult> {
    // Generate a row first to get the ID
    const fileExt = file.originalname.split('.').pop()?.toLowerCase() || 'bin';
    const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    // Upload to Supabase Storage
    let storagePathFinal: string | null = null;
    try {
      await this.ensureBucket();
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });
      if (!uploadErr) {
        storagePathFinal = storagePath;
      } else {
        logger.warn('Storage upload failed (will still extract text)', { error: uploadErr.message });
      }
    } catch (storageErr: any) {
      logger.warn('Storage upload exception (non-fatal)', { error: storageErr.message });
    }

    // Extract text from the document
    let extractedText: string | null = null;
    let extractionStatus: 'success' | 'truncated' | 'failed' = 'failed';
    let extractionChars = 0;
    let extractionReason: string | undefined;

    try {
      const { AttachmentExtractorService } = await import('./attachment-extractor.service');
      const isImage = file.mimetype.startsWith('image/');
      
      if (!isImage) {
        // Create a data URI from the buffer for the extractor
        const base64 = file.buffer.toString('base64');
        const dataUri = `data:${file.mimetype};base64,${base64}`;
        
        const rawText = await AttachmentExtractorService.extractText({
          type: 'document',
          name: file.originalname,
          mimeType: file.mimetype,
          data: dataUri,
        });

        // Check if OCR was applied (set by extractText for scanned PDFs)
        const ocrMethod = (AttachmentExtractorService as any)._lastOcrMethod as string | undefined;
        (AttachmentExtractorService as any)._lastOcrMethod = undefined;
        const wasOcr = !!ocrMethod;

        if (rawText && rawText.length > 0) {
          const ocrNote = wasOcr ? ' (via OCR — scanned PDF)' : '';
          if (rawText.length > MAX_EXTRACTED_TEXT) {
            // Smart truncation — keep the most relevant portions
            extractedText = AttachmentExtractorService.smartTruncate(rawText, '', MAX_EXTRACTED_TEXT);
            extractionStatus = 'truncated';
            extractionChars = extractedText.length;
            extractionReason = `Truncated from ${rawText.length} to ${extractedText.length} chars${ocrNote}`;
          } else {
            extractedText = rawText;
            extractionStatus = 'success';
            extractionChars = rawText.length;
            if (wasOcr) {
              extractionReason = `Text extracted via OCR — scanned PDF detected`;
            }
          }
        } else {
          extractionStatus = 'failed';
          extractionReason = wasOcr
            ? 'OCR was attempted but could not extract readable text from this scanned PDF'
            : 'No text content extracted';
        }
      } else {
        // Images don't have extracted text — they use vision
        extractionStatus = 'success';
        extractionChars = 0;
      }
    } catch (extractErr: any) {
      extractionStatus = 'failed';
      extractionReason = extractErr.message || 'Extraction error';
      logger.warn('Text extraction failed', { file: file.originalname, error: extractErr.message });
    }

    // Insert into database
    const { data, error } = await supabaseAdmin
      .from('chat_attachments')
      .insert({
        user_id: userId,
        conversation_id: conversationId || null,
        file_name: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
        storage_path: storagePathFinal,
        extracted_text: extractedText,
        extraction_status: extractionStatus,
        extraction_chars: extractionChars,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to insert chat_attachment row', { error: error.message });
      throw new AppError('Failed to save attachment', 500, 'ATTACHMENT_SAVE_ERROR');
    }

    logger.info('Chat attachment uploaded', {
      id: data.id,
      userId,
      file: file.originalname,
      size: file.size,
      extractionStatus,
      extractionChars,
    });

    return {
      id: data.id,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      extractionStatus,
      extractionChars,
      extractionReason,
    };
  }

  /**
   * Resolve one or more attachment IDs to their extracted text.
   * Used by the AI pipeline on follow-up messages to load context
   * without re-sending base64 payloads.
   */
  static async resolveByIds(
    attachmentIds: string[],
    userId: string,
  ): Promise<Array<{ id: string; fileName: string; mimeType: string; extractedText: string | null; storagePath: string | null }>> {
    if (attachmentIds.length === 0) return [];

    const { data, error } = await supabaseAdmin
      .from('chat_attachments')
      .select('id, file_name, mime_type, extracted_text, storage_path')
      .in('id', attachmentIds)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to resolve chat attachments', { error: error.message });
      throw new AppError('Failed to load attachments', 500, 'ATTACHMENT_RESOLVE_ERROR');
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      extractedText: row.extracted_text,
      storagePath: row.storage_path,
    }));
  }

  /**
   * Get the raw file buffer from Supabase Storage (for re-download or re-processing).
   */
  static async downloadFile(attachmentId: string, userId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const { data: row, error } = await supabaseAdmin
      .from('chat_attachments')
      .select('file_name, mime_type, storage_path')
      .eq('id', attachmentId)
      .eq('user_id', userId)
      .single();

    if (error || !row) {
      throw new NotFoundError('Attachment not found');
    }

    if (!row.storage_path) {
      throw new AppError('File not available in storage', 404, 'FILE_NOT_IN_STORAGE');
    }

    const { data: fileData, error: downloadErr } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .download(row.storage_path);

    if (downloadErr || !fileData) {
      throw new AppError('Failed to download file', 500, 'DOWNLOAD_ERROR');
    }

    const arrayBuffer = await fileData.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      fileName: row.file_name,
      mimeType: row.mime_type,
    };
  }

  /**
   * Delete an attachment (DB row + storage file).
   */
  static async delete(attachmentId: string, userId: string): Promise<void> {
    const { data: row } = await supabaseAdmin
      .from('chat_attachments')
      .select('storage_path')
      .eq('id', attachmentId)
      .eq('user_id', userId)
      .single();

    if (row?.storage_path) {
      try {
        await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([row.storage_path]);
      } catch (err: any) {
        logger.warn('Failed to delete storage file', { attachmentId, error: err.message });
      }
    }

    await supabaseAdmin
      .from('chat_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('user_id', userId);
  }

  /**
   * List attachments for a conversation.
   */
  static async listByConversation(conversationId: string, userId: string): Promise<ChatAttachmentRow[]> {
    const { data, error } = await supabaseAdmin
      .from('chat_attachments')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to list chat attachments', { error: error.message });
      return [];
    }

    return data || [];
  }

  /**
   * Link one or more attachments to a conversation.
   * Attachments are uploaded before the conversation exists, so conversation_id
   * is initially NULL. This method is called by the pipeline when it first
   * processes the attachments and knows the conversationId.
   */
  static async linkToConversation(
    attachmentIds: string[],
    conversationId: string,
    userId: string,
  ): Promise<void> {
    if (attachmentIds.length === 0) return;

    const { error } = await supabaseAdmin
      .from('chat_attachments')
      .update({ conversation_id: conversationId })
      .in('id', attachmentIds)
      .eq('user_id', userId)
      .is('conversation_id', null); // only update unlinked rows

    if (error) {
      logger.warn('Failed to link attachments to conversation', {
        conversationId,
        attachmentIds,
        error: error.message,
      });
    } else {
      logger.info('Linked attachments to conversation', {
        conversationId,
        count: attachmentIds.length,
      });
    }
  }

  /**
   * Delete ALL attachments for a conversation (storage files + DB rows).
   * Called when a conversation is deleted so attachments don't become orphans.
   */
  static async deleteByConversation(conversationId: string, userId: string, metadataFileIds?: string[]): Promise<number> {
    // 1. Fetch all attachment rows linked to this conversation
    const { data: rows, error: fetchErr } = await supabaseAdmin
      .from('chat_attachments')
      .select('id, storage_path')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    // 2. Also fetch any unlinked rows referenced by fileId in conversation metadata
    //    (attachments uploaded before conversation_id was linked)
    let metadataRows: typeof rows = [];
    if (metadataFileIds && metadataFileIds.length > 0) {
      const { data: mRows } = await supabaseAdmin
        .from('chat_attachments')
        .select('id, storage_path')
        .in('id', metadataFileIds)
        .eq('user_id', userId);
      metadataRows = mRows || [];
    }

    // Merge and deduplicate
    const allRows = [...(rows || []), ...(metadataRows || [])];
    const seen = new Set<string>();
    const uniqueRows = allRows.filter((r: any) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    if (fetchErr) {
      logger.error('Failed to fetch attachments for conversation cleanup', {
        conversationId,
        error: fetchErr.message,
      });
      // Still try metadata rows if we have them
      if (uniqueRows.length === 0) return 0;
    }

    if (uniqueRows.length === 0) return 0;

    // 3. Delete storage files (batch remove)
    const storagePaths = uniqueRows
      .map((r: any) => r.storage_path)
      .filter((p: string | null): p is string => !!p);

    if (storagePaths.length > 0) {
      try {
        await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(storagePaths);
      } catch (storageErr: any) {
        logger.warn('Failed to delete some storage files during conversation cleanup', {
          conversationId,
          count: storagePaths.length,
          error: storageErr.message,
        });
      }
    }

    // 4. Delete DB rows by IDs
    const idsToDelete = uniqueRows.map((r: any) => r.id);
    const { error: deleteErr } = await supabaseAdmin
      .from('chat_attachments')
      .delete()
      .in('id', idsToDelete)
      .eq('user_id', userId);

    if (deleteErr) {
      logger.error('Failed to delete attachment DB rows during conversation cleanup', {
        conversationId,
        error: deleteErr.message,
      });
      return 0;
    }

    logger.info('Cleaned up attachments for deleted conversation', {
      conversationId,
      userId,
      attachmentCount: uniqueRows.length,
      storageFilesRemoved: storagePaths.length,
    });

    return uniqueRows.length;
  }
}
