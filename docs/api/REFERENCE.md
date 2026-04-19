# Quill AI API Reference

Complete API documentation for Quill AI's REST endpoints.

## Base URL

```
https://quill-ai-xi.vercel.app/api
```

## Authentication

Most endpoints require authentication via session cookies managed by Better Auth. Guest access is available for limited functionality.

## Rate Limiting

All endpoints are rate-limited. Headers included in every response:

| Header | Description |
|--------|-------------|
| `x-ratelimit-limit` | Maximum requests per window |
| `x-ratelimit-remaining` | Remaining requests in current window |
| `retry-after` | Seconds to wait before retrying (when limited) |
| `x-request-id` | Unique request identifier for debugging |

### Default Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/chat` | 20 req/min | 60 seconds |
| `/api/image` | 6 req/min | 60 seconds |
| Daily chat (fast) | 80 messages | 24 hours |
| Daily chat (think) | 40 messages | 24 hours |
| Daily chat (pro) | 120 messages | 24 hours |
| Daily web search | 20 (free) / 100 (paid) | 24 hours |

---

## Endpoints

### POST `/api/chat`

Send a message to the AI chat and receive a streaming response.

**Authentication:** Optional (guest mode available for fast mode only)

**Request Body:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Create a landing page for a SaaS product"
    }
  ],
  "mode": "fast",
  "chatId": "uuid-or-create-new",
  "builderTarget": "auto",
  "builderLocks": {
    "layout": false,
    "colors": false,
    "sectionOrder": false,
    "copy": false
  },
  "webSearch": false,
  "killerId": null,
  "userCustomization": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | `UIMessage[]` | Yes | Array of chat messages in AI SDK format |
| `mode` | `string` | No | Chat mode: `"fast"`, `"thinking"`, `"advanced"`. Default: `"advanced"` |
| `chatId` | `string` | No | Chat session ID. Creates new chat if not provided |
| `builderTarget` | `string` | No | Artifact type: `"auto"`, `"page"`, `"react-app"`, `"nextjs-bundle"` |
| `builderLocks` | `object` | No | Iteration locks to preserve elements during refinements |
| `webSearch` | `boolean` | No | Enable web search for real-time information |
| `killerId` | `string` | No | Execution policy ID for autonomy control |
| `userCustomization` | `object` | No | User preferences and profile customization |

**Response:** Streaming `UIMessageStreamResponse`

**Stream Events:**

| Event | Description |
|-------|-------------|
| `start` | Stream initiated |
| `start-step` | New step in reasoning |
| `text-start` | Text content beginning |
| `text-delta` | Text chunk |
| `text-end` | Text content complete |
| `tool-call` | Tool execution request |
| `tool-result` | Tool execution result |
| `finish` | Stream complete |
| `error` | Error occurred |

**Error Response:**

```json
{
  "error": "Sign in required to use this feature.",
  "code": "auth_required_mode",
  "suggestion": "Please sign in to access Think and Pro modes.",
  "requestId": "req_abc123"
}
```

**Status Codes:**

| Code | Meaning |
|------|---------|
| `200` | Success, streaming response |
| `400` | Invalid request body |
| `401` | Authentication required |
| `402` | Paid mode required |
| `403` | Access forbidden (wrong chat owner) |
| `429` | Rate limit or daily quota exceeded |
| `499` | Client closed connection |
| `500` | Internal server error |

---

### POST `/api/image`

Generate images using AI.

**Authentication:** Required

**Request Body:**

```json
{
  "prompt": "A modern office space with large windows",
  "chatId": "chat-uuid",
  "negativePrompt": "blurry, low quality",
  "width": 1024,
  "height": 768,
  "numImages": 1
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | `string` | Yes | Text description of the image |
| `chatId` | `string` | Yes | Associated chat session |
| `negativePrompt` | `string` | No | What to exclude from the image |
| `width` | `number` | No | Image width (default: 1024) |
| `height` | `number` | No | Image height (default: 768) |
| `numImages` | `number` | No | Number of images to generate (1-4) |

**Response:** JSON with image URLs

---

### GET `/api/health`

Check API health status.

**Authentication:** Not required

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2026-04-19T01:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "ai": "connected"
  }
}
```

---

### GET `/api/metrics`

Get system metrics and usage statistics.

**Authentication:** Required (admin token via `x-metrics-token` header)

**Response:**

```json
{
  "activeUsers": 142,
  "totalChats": 1523,
  "totalMessages": 45231,
  "modelUsage": {
    "gemini-2.5-flash-lite": { "inputTokens": 1234567, "outputTokens": 234567 },
    "gemini-2.5-flash": { "inputTokens": 567890, "outputTokens": 123456 },
    "gemini-2.5-pro": { "inputTokens": 890123, "outputTokens": 345678 }
  },
  "dailyActiveUsers": 89,
  "weeklyActiveUsers": 312
}
```

---

### GET `/api/chats`

List user's chat sessions.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | `number` | Maximum results (default: 50, max: 100) |
| `cursor` | `string` | Pagination cursor for next page |

**Response:**

```json
{
  "chats": [
    {
      "id": "chat-uuid",
      "title": "Landing page design",
      "createdAt": "2026-04-19T00:00:00.000Z",
      "updatedAt": "2026-04-19T01:00:00.000Z",
      "messageCount": 5
    }
  ],
  "hasMore": true,
  "nextCursor": "eyJpZCI6ImNoYXQtMTIzIn0="
}
```

---

### GET `/api/chats/:id`

Get a specific chat with its messages.

**Authentication:** Required

**Response:**

```json
{
  "id": "chat-uuid",
  "title": "Landing page design",
  "createdAt": "2026-04-19T00:00:00.000Z",
  "updatedAt": "2026-04-19T01:00:00.000Z",
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "Create a landing page",
      "createdAt": "2026-04-19T00:00:00.000Z"
    },
    {
      "id": "msg-2",
      "role": "assistant",
      "content": "Here's a landing page...",
      "createdAt": "2026-04-19T00:01:00.000Z"
    }
  ]
}
```

---

### DELETE `/api/chats/:id`

Delete a chat session.

**Authentication:** Required

**Response:** `204 No Content` on success

---

### POST `/api/share/:id`

Create a shareable link for a chat.

**Authentication:** Required (must own the chat)

**Response:**

```json
{
  "shareUrl": "https://quill-ai-xi.vercel.app/share/abc123",
  "expiresAt": null
}
```

---

### GET `/api/templates`

Get available builder templates.

**Authentication:** Not required

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | `string` | Filter by category: `landing`, `dashboard`, `portfolio`, `ecommerce`, `documentation` |
| `search` | `string` | Search templates by name, description, or tags |
| `popular` | `number` | Get top N popular templates |

**Response:**

```json
{
  "category": null,
  "total": 5,
  "templates": [
    {
      "id": "saas-landing",
      "name": "SaaS Product Launch",
      "description": "Modern landing page for SaaS product launches",
      "category": "landing",
      "tags": ["saas", "product", "startup", "modern"],
      "popularity": 95
    }
  ]
}
```

---

### POST `/api/templates`

Generate a builder prompt from a template.

**Authentication:** Not required

**Request Body:**

```json
{
  "templateId": "saas-landing",
  "customizations": {
    "productName": "MySaaS",
    "brandName": "My Company",
    "primaryColor": "#6366F1",
    "industry": "technology"
  }
}
```

**Response:**

```json
{
  "template": { ... },
  "generatedPrompt": "Create a modern SaaS landing page... The product name is \"MySaaS\"..."
}
```

---

## Error Codes Reference

| Code | HTTP Status | Description | User Message |
|------|-------------|-------------|--------------|
| `auth_required_mode` | 401 | Sign in needed for Think/Pro modes | "Sign in required to use this feature." |
| `auth_required_web_search` | 401 | Sign in needed for web search | "Sign in required for web search." |
| `chat_forbidden` | 403 | Chat belongs to another user | "You do not have access to this chat." |
| `rate_limit` | 429 | Too many requests per minute | "Too many requests. Please slow down." |
| `daily_quota_reached` | 429 | Daily message limit reached | "Daily message limit reached." |
| `web_search_daily_quota_reached` | 429 | Daily web search limit reached | "Daily web search limit reached." |
| `paid_mode_required` | 402 | Paid plan needed | "This feature requires a paid plan." |
| `invalid_request_body` | 400 | Malformed request | "Invalid request format." |
| `no_messages` | 400 | Empty message array | "No messages provided." |
| `web_search_not_configured` | 503 | Web search unavailable | "Web search is not available." |
| `internal_error` | 500 | Server error | "Something went wrong on our end." |
| `client_aborted` | 499 | Client closed connection | "Request cancelled." |

---

## Webhooks (Coming Soon)

Quill AI will support webhooks for:
- Chat completion events
- Artifact generation complete
- Usage threshold alerts

---

## SDKs & Client Libraries

### JavaScript/TypeScript

```typescript
import { QuillClient } from '@quill-ai/client';

const client = new QuillClient({
  baseUrl: 'https://quill-ai-xi.vercel.app/api',
});

// Send a chat message
const stream = await client.chat.stream({
  messages: [{ role: 'user', content: 'Hello!' }],
  mode: 'fast',
});

for await (const chunk of stream) {
  console.log(chunk.text);
}
```

### Python (Coming Soon)

```python
from quill_ai import QuillClient

client = QuillClient(base_url="https://quill-ai-xi.vercel.app/api")

response = client.chat.create(
    messages=[{"role": "user", "content": "Hello!"}],
    mode="fast"
)
```

---

## Changelog

### v1.0.0 (2026-04-19)
- Initial API release
- Chat endpoint with streaming
- Builder templates
- Rate limiting and quotas
- Enhanced error messages
