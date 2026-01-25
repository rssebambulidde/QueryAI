import { Router, Request, Response } from 'express';
import { EmbeddingConfigService } from '../services/embedding-config.service';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError, ValidationError } from '../types/error';
import { AIService, QuestionRequest } from '../services/ai.service';
import logger from '../config/logger';

const router = Router();

// Handle OPTIONS requests for CORS preflight
router.options('/:configId/ask', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).end();
});

/**
 * GET /api/embed/:configId
 * Public endpoint to serve embeddable chatbot widget
 * No authentication required (public embedding)
 */
router.get(
  '/:configId',
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
    const primaryColor = (customization.primaryColor || '#f97316').replace(/[<>'"]/g, ''); // Orange default, sanitize
    const backgroundColor = (customization.backgroundColor || '#ffffff').replace(/[<>'"]/g, '');
    const textColor = (customization.textColor || '#1f2937').replace(/[<>'"]/g, '');
    const greetingMessage = (customization.greetingMessage || 'Hello! How can I help you today?')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const showBranding = customization.showBranding !== false;

    // Sanitize topic data
    const topicName = topic.name
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const topicDescription = topic.description
      ? topic.description
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
      : '';

    // Get API URL - use the request's origin if available, otherwise use env var
    let apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    // If we have the request origin, use it (for same-origin requests)
    if (req.headers.origin) {
      apiUrl = req.headers.origin;
    } else if (req.headers.host) {
      // Fallback to request host
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      apiUrl = `${protocol}://${req.headers.host}`;
    }
    
    apiUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Frame-Options', 'ALLOWALL'); // Allow iframe embedding
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow embedding from any origin
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
    .queryai-message.assistant p {
      margin: 0.5rem 0;
      line-height: 1.5;
    }
    .queryai-message.assistant p:first-child {
      margin-top: 0;
    }
    .queryai-message.assistant p:last-child {
      margin-bottom: 0;
    }
    .queryai-message.assistant strong {
      font-weight: 600;
      color: ${textColor};
    }
    .queryai-message.assistant em {
      font-style: italic;
    }
    .queryai-message.assistant code {
      background: rgba(0, 0, 0, 0.1);
      padding: 0.2rem 0.4rem;
      border-radius: 0.25rem;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    .queryai-message.assistant ul,
    .queryai-message.assistant ol {
      margin: 0.5rem 0;
      padding-left: 1.5rem;
    }
    .queryai-message.assistant li {
      margin: 0.25rem 0;
      line-height: 1.5;
    }
    .queryai-message.assistant a {
      color: ${primaryColor};
      text-decoration: underline;
    }
    .queryai-message.assistant a:hover {
      opacity: 0.8;
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
        <h2>${topicName}</h2>
        ${topicDescription ? `<p style="font-size: 0.875rem; opacity: 0.9;">${topicDescription}</p>` : ''}
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
      const apiUrl = '${apiUrl}';
      const topicId = '${config.topic_id}';
      
      const messagesContainer = document.getElementById('queryai-chat-messages');
      const input = document.getElementById('queryai-chat-input');
      const sendButton = document.getElementById('queryai-chat-send');
      
      // Simple markdown to HTML converter
      function markdownToHtml(markdown) {
        if (!markdown) return '';
        
        let html = markdown;
        
        // Escape HTML first to prevent XSS (but preserve newlines)
        html = html
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        
        // Convert newlines to <br> first (before other processing)
        html = html.replace(/\\n/g, '<br>');
        
        // Links: [text](url) - do this before other formatting
        html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Bold: **text** (but not if it's part of a link)
        html = html.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
        
        // Italic: *text* (but not if it's part of bold) - simplified
        html = html.replace(/(^|[^*])\\*([^*]+)\\*([^*]|$)/g, '$1<em>$2</em>$3');
        
        // Code: backtick code - use String.fromCharCode to avoid template literal issues
        const backtick = String.fromCharCode(96);
        const codeRegex = new RegExp(backtick + '([^' + backtick + ']+)' + backtick, 'g');
        html = html.replace(codeRegex, '<code>$1</code>');
        
        // Convert <br><br> to paragraph breaks
        html = html.split('<br><br>').map(function(para) {
          para = para.trim();
          if (!para) return '';
          // Remove leading/trailing <br> tags
          para = para.replace(/^(<br>)+|(<br>)+$/g, '');
          return '<p>' + para + '</p>';
        }).join('');
        
        // Lists: - item or * item (handle after paragraph conversion)
        const listPattern = /(<p>)?(-|\\*|\\d+\\.) (.+?)(<\\/p>)?/g;
        html = html.replace(listPattern, function(match, p1, marker, content, p4) {
          const listType = /^\\d+\\./.test(marker) ? 'ol' : 'ul';
          return '<' + listType + '><li>' + content + '</li></' + listType + '>';
        });
        
        // Clean up nested lists
        html = html.replace(/<\\/ul>\\s*<ul>/g, '');
        html = html.replace(/<\\/ol>\\s*<ol>/g, '');
        
        return html;
      }
      
      function addMessage(content, role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'queryai-message ' + role;
        
        // For assistant messages, render markdown; for user messages, use plain text
        if (role === 'assistant') {
          messageDiv.innerHTML = markdownToHtml(content);
        } else {
          messageDiv.textContent = content;
        }
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return messageDiv;
      }
      
      async function sendMessage() {
        const question = input.value.trim();
        if (!question) return;
        
        addMessage(question, 'user');
        input.value = '';
        sendButton.disabled = true;
        
        // Show loading indicator
        const loadingMessage = addMessage('Thinking...', 'assistant');
        
        try {
          const fetchUrl = apiUrl + '/api/embed/' + configId + '/ask';
          console.log('Fetching from:', fetchUrl);
          
          const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              question: question
            }),
            mode: 'cors', // Explicitly enable CORS
          });
          
          // Remove loading message
          if (loadingMessage && loadingMessage.parentNode) {
            loadingMessage.parentNode.removeChild(loadingMessage);
          }
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: 'Network error' } }));
            throw new Error(errorData.error?.message || 'Request failed');
          }
          
          const data = await response.json();
          if (data.success && data.data && data.data.answer) {
            addMessage(data.data.answer, 'assistant');
          } else {
            console.error('Unexpected response format:', data);
            addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
          }
        } catch (error) {
          // Remove loading message if still present
          if (loadingMessage && loadingMessage.parentNode) {
            loadingMessage.parentNode.removeChild(loadingMessage);
          }
          console.error('Error sending message:', error);
          addMessage('Sorry, I encountered an error: ' + (error.message || 'Unknown error'), 'assistant');
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
  '/:configId/ask',
  asyncHandler(async (req: Request, res: Response) => {
    // Set CORS headers for embed requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
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

    try {
      // Note: For embedded chatbot, we use the config's user_id but scope to the topic
      // This ensures topic-based access control
      const response = await AIService.answerQuestion(request, config.user_id);

      logger.info('Embedded chatbot response generated', {
        configId,
        topicId: config.topic_id,
        answerLength: response.answer?.length || 0,
      });

      res.json({
        success: true,
        data: response,
      });
    } catch (error: any) {
      logger.error('Error generating embedded chatbot response', {
        configId,
        topicId: config.topic_id,
        error: error.message,
        stack: error.stack,
      });

      // Return error response instead of throwing
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Failed to generate response',
          code: 'EMBEDDING_RESPONSE_ERROR',
        },
      });
    }
  })
);

export default router;
