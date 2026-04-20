# BRAIN.md - How Systems Think

**Created:** April 20, 2026 | **Status:** Active Architecture Document

---

## Core Architecture Philosophy

Quill AI operates on a **two-pass builder pattern** that separates reasoning from response generation. This ensures high-quality AI responses while maintaining system safety and performance.

---

## Architecture Overview

### Technology Stack
- **Frontend:** Next.js 16 App Router + React 19 + TypeScript + Tailwind 4
- **Database:** Neon PostgreSQL with Drizzle ORM + pgvector for RAG
- **Authentication:** Better Auth + OIDC integration  
- **AI Core:** Google Gemini + OpenRouter + Vercel AI SDK
- **Execution:** Docker sandbox + E2B integration
- **Infrastructure:** Vercel deployment + CI/CD workflows

### System Design Patterns

#### 1. Two-Pass Builder System
```
User Request → Policy Runtime → Access Gates → Model Selection → 
Pass 1: Reasoning → Pass 2: Response → Stream Output
```

#### 2. Decomposed Chat Backend (5 modules)
- **request-utils.ts**: Parsing, validation, message extraction
- **model-selection.ts**: Mode typing, model resolution, limits
- **access-gates.ts**: Entitlement, quota, guest restrictions
- **policy-runtime.ts**: Permissions, sandboxing, code execution safety
- **two-pass-builder.ts**: Response orchestration and persistence

#### 3. Tiered Access Control
- **Free**: Basic chat, limited attempts
- **Trial**: Advanced features, increased limits
- **Paid**: Full access, priority service

#### 4. Memory Bank Governance
- Context persistence across sessions
- Decision records for architectural choices
- Development workflow tracking

---

## Core Data Flow

### Chat Interaction Flow
```
1. User Input → API Route
2. Request Parsing → Message Extraction
3. Policy Runtime → Access Evaluation
4. Model Selection → Provider Resolution
5. Two-Pass Builder → Reasoning + Response
6. Stream Output → Client Update
```

### Artifact Generation Flow
```
1. User Request → Builder Trigger
2. Model Selection → Content Generation
3. Artifact Creation → Canvas Preview
4. Version Storage → User Interface
```

### Cost Tracking Flow
```
1. Usage Event → Model Tracking
2. Token Counting → Cost Calculation
3. Database Storage → Cost Reporting
4. Projections → Optimization Insights
```

---

## AI/ML Integration

### Provider Strategy
- **Primary**: Google Gemini (quality/reliability)
- **Secondary**: OpenRouter (extended model access)
- **Specialized**: Imagen (image generation)

### Model Selection Logic
```typescript
// Pseudo-code for model resolution
resolveModelForMode(mode: ChatMode): Model {
  switch(mode) {
    case 'fast': return gemini-2.5-flash-lite;
    case 'thinking': return gemini-2.5-flash;  
    case 'advanced': return gemini-2.5-pro;
  }
}
```

### Safety Systems
- **Runtime Policy Evaluation**: Sandbox permission decisions
- **Content Filtering**: Input/output sanitization
- **Usage Limits**: Rate limiting and quota enforcement

---

## State Management

### Persistence Layers
- **Database**: User data, sessions, messages, artifacts
- **In-Memory**: Active metrics, rate limiting, caching
- **Local Storage**: UI preferences, guest sessions

### State Synchronization
- **Real-time**: Live status updates during streaming
- **Batch**: Bulk operations for large datasets
- **Event-driven**: User actions trigger state updates

---

## Performance & Optimization

### Caching Strategy
- **Token-based**: User context caching
- **Artifact-based**: Preview results caching
- **Rate limiting**: Request-level caching

### Performance Monitoring
- **In-Metrics**: Stream timing, token counts, response quality
- **Budgets**: Bundle size, loading times, execution limits
- **Optimization**: Memoization, virtualization, lazy loading

---

## Extension Points

### Skills & Extensibility
- **MCP Protocol**: Third-party tool integrations
- **Skills Marketplace**: User-installed capabilities
- **Autopilot Workflows**: Scheduled automation

### Provider Integration
- **Google Workspace**: Document processing
- **Custom APIs**: External service connections
- **Execution Service**: Code sandbox integration

---

## Error Handling & Recovery

### Error Categories
- **Network**: Connection failures, timeouts
- **AI Service**: Model failures, rate limits
- **User Input**: Invalid requests, malformed data
- **System**: Resource constraints, service downtime

### Recovery Patterns
- **Retry Logic**: Transient failure handling
- **Graceful Degradation**: Feature fallbacks
- **User Feedback**: Clear error messages, actionable guidance

---

## Future Evolution

### Scalability Considerations
- **Horizontal Scaling**: Multi-instance deployment
- **Database Optimization**: Connection pooling, query optimization
- **CDN Integration**: Asset and API caching

### Technology Radar
- **Type Safety**: Advanced TypeScript features, type-safe APIs
- **Performance**: React Server Components, Next.js optimizations
- **AI Integration**: New model providers, enhanced reasoning capabilities
- **DevOps**: Enhanced CI/CD, monitoring, observability
