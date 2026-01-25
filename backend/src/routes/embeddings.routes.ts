import { Router, Request, Response } from 'express';
import { EmbeddingConfigService, CreateEmbeddingConfigInput, UpdateEmbeddingConfigInput } from '../services/embedding-config.service';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError, ValidationError } from '../types/error';
import { AIService, QuestionRequest } from '../services/ai.service';
import logger from '../config/logger';

const router = Router();

/**
 * GET /api/embeddings
 * Get all embedding configurations for the authenticated user
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const configs = await EmbeddingConfigService.getUserEmbeddingConfigs(userId);

    res.json({
      success: true,
      data: configs,
    });
  })
);

/**
 * GET /api/embeddings/:id
 * Get embedding configuration by ID
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const configId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const config = await EmbeddingConfigService.getEmbeddingConfig(configId, userId);

    if (!config) {
      throw new AppError('Embedding configuration not found', 404, 'EMBEDDING_NOT_FOUND');
    }

    res.json({
      success: true,
      data: config,
    });
  })
);

/**
 * POST /api/embeddings
 * Create a new embedding configuration
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { name, topicId, customization } = req.body;

    if (!name || name.trim().length === 0) {
      throw new ValidationError('Configuration name is required');
    }

    if (!topicId) {
      throw new ValidationError('Topic ID is required');
    }

    const input: CreateEmbeddingConfigInput = {
      userId,
      topicId,
      name,
      customization,
    };

    const config = await EmbeddingConfigService.createEmbeddingConfig(input);

    res.status(201).json({
      success: true,
      data: config,
    });
  })
);

/**
 * PUT /api/embeddings/:id
 * Update an embedding configuration
 */
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const configId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, customization, isActive } = req.body;

    const updates: UpdateEmbeddingConfigInput = {};
    if (name !== undefined) updates.name = name;
    if (customization !== undefined) updates.customization = customization;
    if (isActive !== undefined) updates.isActive = isActive;

    const config = await EmbeddingConfigService.updateEmbeddingConfig(configId, userId, updates);

    res.json({
      success: true,
      data: config,
    });
  })
);

/**
 * DELETE /api/embeddings/:id
 * Delete an embedding configuration
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const configId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    await EmbeddingConfigService.deleteEmbeddingConfig(configId, userId);

    res.json({
      success: true,
      message: 'Embedding configuration deleted successfully',
    });
  })
);

/**
 * GET /api/embed/:configId
 * Public endpoint to serve embeddable chatbot widget
 * No authentication required (public embedding)
 */
router.get(
  '/embed/:configId',
  asyncHandler(async (req: Request, res: Response) => {
    const configId = Array.isArray(req.params.configId) ? req.params.configId[0] : req.params.configId;

    const config = await EmbeddingConfigService.getEmbeddingConfig(configId);
    if (!config || !config.is_active) {
      return res.status(404).send('Embedding configuration not found or inactive');
    }

    // Get topic details
    const { TopicService } = await import('../services/topic.service');
    const topic = await TopicService.getTopic(config.topic_id, config.user_id);
    if (!topic) {
      return res.status(404).send('Topic not found');
    }

    // Serve HTML page with embedded chatbot
    const customization = config.customization || {};
    const primaryColor = customization.primaryColor || '#f97316'; // Orange default
    const backgroundColor = customization.backgroundColor || '#ffffff';
    const textColor = customization.textColor || '#1f2937';
    const greetingMessage = customization.greetingMessage || 'Hello! How can I help you today?';
    const showBranding = customization.showBranding !== false;

    res.setHeader('Content-Type', 'text/html');
    return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QueryAI Chat</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: ${backgroundColor};
      color: ${textColor};
      height: 100vh;
      overflow: hidden;
    }
    #queryai-chat-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    #queryai-chat-header {
      background: ${primaryColor};
      color: white;
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    #queryai-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .queryai-message {
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      max-width: 80%;
    }
    .queryai-message.user {
      align-self: flex-end;
      background: ${primaryColor};
      color: white;
    }
    .queryai-message.assistant {
      align-self: flex-start;
      background: #f3f4f6;
      color: ${textColor};
    }
    #queryai-chat-input-container {
      border-top: 1px solid #e5e7eb;
      padding: 1rem;
      display: flex;
      gap: 0.5rem;
    }
    #queryai-chat-input {
      flex: 1;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
      font-size: 1rem;
    }
    #queryai-chat-send {
      padding: 0.75rem 1.5rem;
      background: ${primaryColor};
      color: white;
      border: none;
      border-radius: 0.5rem;
      cursor: pointer;
      font-weight: 500;
    }
    #queryai-chat-send:hover {
      opacity: 0.9;
    }
    #queryai-chat-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .queryai-branding {
      font-size: 0.75rem;
      opacity: 0.7;
      text-align: center;
      padding: 0.5rem;
    }
  </style>
</head>
<body>
  <div id="queryai-chat-container">
    <div id="queryai-chat-header">
      <div>
        <h2>${topic.name}</h2>
        ${topic.description ? `<p style="font-size: 0.875rem; opacity: 0.9;">${topic.description}</p>` : ''}
      </div>
    </div>
    <div id="queryai-chat-messages">
      <div class="queryai-message assistant">
        ${greetingMessage}
      </div>
    </div>
    <div id="queryai-chat-input-container">
      <input type="text" id="queryai-chat-input" placeholder="Ask a question..." />
      <button id="queryai-chat-send">Send</button>
    </div>
    ${showBranding ? '<div class="queryai-branding">Powered by QueryAI</div>' : ''}
  </div>
  <script>
    (function() {
      const configId = '${configId}';
      const apiUrl = '${process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}';
      const topicId = '${config.topic_id}';
      
      const messagesContainer = document.getElementById('queryai-chat-messages');
      const input = document.getElementById('queryai-chat-input');
      const sendButton = document.getElementById('queryai-chat-send');
      
      function addMessage(content, role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'queryai-message ' + role;
        messageDiv.textContent = content;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
      
      async function sendMessage() {
        const question = input.value.trim();
        if (!question) return;
        
        addMessage(question, 'user');
        input.value = '';
        sendButton.disabled = true;
        
        try {
          const response = await fetch(apiUrl + '/api/v1/ask', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              question: question,
              topicId: topicId
            })
          });
          
          const data = await response.json();
          if (data.success && data.data) {
            addMessage(data.data.answer, 'assistant');
          } else {
            addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
          }
        } catch (error) {
          addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
        } finally {
          sendButton.disabled = false;
        }
      }
      
      sendButton.addEventListener('click', sendMessage);
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          sendMessage();
        }
      });
    })();
  </script>
</body>
</html>
    `);
  })
);

/**
 * POST /api/embed/:configId/ask
 * Handle question from embedded chatbot
 */
router.post(
  '/embed/:configId/ask',
  asyncHandler(async (req: Request, res: Response) => {
    const configId = Array.isArray(req.params.configId) ? req.params.configId[0] : req.params.configId;
    const { question } = req.body;

    if (!question || question.trim().length === 0) {
      throw new ValidationError('Question is required');
    }

    const config = await EmbeddingConfigService.getEmbeddingConfig(configId);
    if (!config || !config.is_active) {
      throw new AppError('Embedding configuration not found or inactive', 404, 'EMBEDDING_NOT_FOUND');
    }

    // Build request scoped to the embedding's topic
    const request: QuestionRequest = {
      question,
      topicId: config.topic_id,
      enableDocumentSearch: true,
      enableWebSearch: true,
      maxDocumentChunks: 5,
      maxSearchResults: 5,
    };

    logger.info('Embedded chatbot question', {
      configId,
      topicId: config.topic_id,
      questionLength: question.length,
    });

      // Note: For embedded chatbot, we use the config's user_id but scope to the topic
      // This ensures topic-based access control
      const response = await AIService.answerQuestion(request, config.user_id);

      logger.info('Embedded chatbot response generated', {
        configId,
        topicId: config.topic_id,
      });

    res.json({
      success: true,
      data: response,
    });
  })
);

export default router;
