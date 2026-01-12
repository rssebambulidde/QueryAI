# AI Integration Quick Start Guide

## Overview

Phase 1.4 adds OpenAI API integration with question-answering endpoints. This guide helps you get started quickly.

---

## Setup

### 1. Install Dependencies

Already installed! The `openai` package is included in `package.json`.

### 2. Environment Variables

Add to your `.env` file:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Get your API key:**
1. Go to https://platform.openai.com/api-keys
2. Create a new secret key
3. Copy and paste into `.env`

**Note:** The API key is optional in the config but required for AI features to work.

---

## API Endpoints

### 1. Non-Streaming Question Answering

**Endpoint:** `POST /api/ai/ask`

**Authentication:** Required (Bearer token)

**Request:**
```json
{
  "question": "What is artificial intelligence?",
  "context": "Optional context to enhance the answer",
  "conversationHistory": [
    { "role": "user", "content": "Previous question" },
    { "role": "assistant", "content": "Previous answer" }
  ],
  "model": "gpt-3.5-turbo",  // Optional
  "temperature": 0.7,        // Optional
  "maxTokens": 1000          // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Question answered successfully",
  "data": {
    "answer": "AI response text...",
    "model": "gpt-3.5-turbo",
    "usage": {
      "promptTokens": 150,
      "completionTokens": 200,
      "totalTokens": 350
    }
  }
}
```

### 2. Streaming Question Answering

**Endpoint:** `POST /api/ai/ask/stream`

**Authentication:** Required (Bearer token)

**Request:** Same as non-streaming

**Response:** Server-Sent Events (SSE) stream
```
data: {"chunk": "AI response chunk..."}
data: {"chunk": "more text..."}
data: {"done": true}
```

---

## Testing

### Using cURL

#### 1. Login to get token:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

#### 2. Ask a question (non-streaming):
```bash
curl -X POST http://localhost:3001/api/ai/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "question": "What is artificial intelligence?",
    "context": "Focus on practical applications"
  }'
```

#### 3. Ask a question (streaming):
```bash
curl -X POST http://localhost:3001/api/ai/ask/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "question": "Explain machine learning in simple terms"
  }'
```

### Using JavaScript (Frontend)

#### Non-Streaming:
```javascript
const response = await fetch('http://localhost:3001/api/ai/ask', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    question: 'What is AI?',
    context: 'Optional context'
  })
});

const data = await response.json();
console.log(data.data.answer);
```

#### Streaming:
```javascript
const response = await fetch('http://localhost:3001/api/ai/ask/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    question: 'What is AI?'
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (data.chunk) {
        console.log(data.chunk);
      }
      if (data.done) {
        console.log('Stream complete');
      }
    }
  }
}
```

---

## Configuration

### Default Settings

- **Model:** `gpt-3.5-turbo` (cost-effective)
- **Temperature:** `0.7` (balanced creativity)
- **Max Tokens:** `1000` (response length limit)
- **Conversation History:** Last 10 messages (to avoid token limits)

### Customization

You can override defaults in the request:

```json
{
  "question": "Your question",
  "model": "gpt-4",           // Use GPT-4 instead
  "temperature": 0.9,         // More creative
  "maxTokens": 2000           // Longer responses
}
```

---

## Error Handling

### Common Errors

1. **Invalid API Key (401)**
   - Error: `AI_API_KEY_INVALID`
   - Solution: Check your `OPENAI_API_KEY` in `.env`

2. **Rate Limit (429)**
   - Error: `AI_RATE_LIMIT`
   - Solution: Wait and retry, or upgrade OpenAI plan

3. **Service Unavailable (503)**
   - Error: `AI_SERVICE_UNAVAILABLE`
   - Solution: OpenAI API is down, try again later

4. **Context Too Long**
   - Error: `CONTEXT_TOO_LONG`
   - Solution: Shorten your question or context

5. **Validation Error (400)**
   - Error: `VALIDATION_ERROR`
   - Solution: Check request format (question required, max 2000 chars)

---

## Next Steps

1. **Test the endpoints** with your OpenAI API key
2. **Integrate with frontend** (Phase 1.5)
3. **Add Tavily Search** (Phase 2.1) for real-time web search
4. **Add document uploads** (Phase 2.2) for RAG

---

## Files Created

- `backend/src/config/openai.ts` - OpenAI client
- `backend/src/services/ai.service.ts` - AI service logic
- `backend/src/routes/ai.routes.ts` - API endpoints
- `backend/PHASE_1.4_AI_INTEGRATION.md` - Full documentation

---

## Support

For issues or questions:
- Check `PHASE_1.4_AI_INTEGRATION.md` for detailed documentation
- Review error logs in backend console
- Verify OpenAI API key is correct
- Check OpenAI API status: https://status.openai.com/
