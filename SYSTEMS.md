# SYSTEMS.md - Core Technical Blueprint

**Created:** April 20, 2026 | **Status:** Active Technical Specification

---

## Infrastructure Stack Architecture

### Frontend Stack
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19 + TypeScript
- **Styling**: Tailwind CSS 4 (PostCSS)
- **Component System**: Modular components with domain organization
- **State Management**: React hooks + context API

### Backend Architecture  
- **API Pattern**: Next.js App Router routes (`/api/` endpoints)
- **Module Organization**: Decomposed chat backend + domain-specific routes
- **File Structure**: 
  - `src/app/api/` - API route handlers (36 endpoints)
  - `src/lib/` - Business logic modules (28 top-level + organized by domain)
  - `src/components/` - React UI layer (135+ components)
  - `src/db/` - Database schema + migrations

### Database Architecture
- **Provider**: Neon PostgreSQL (serverless)
- **ORM**: Drizzle ORM with TypeScript integration
- **Schema**: Comprehensive data model with relationships
- **Features**: RAG support (pgvector), user data, sessions, artifacts
- **Migrations**: Automated schema management with drizzle-kit

### Authentication & Security
- **Auth System**: Better Auth with OIDC integration
- **Session Management**: Token-based session handling
- **Security Headers**: CSP, HSTS, XSS protection
- **Rate Limiting**: Per-user request throttling
- **Input Sanitization**: Request validation + response filtering

### AI Integration Stack
- **SDK**: Vercel AI SDK with Google Gemini integration
- **Model Providers**: 
  - Primary: Google Gemini (gemini-2.5-flash, gemini-2.5-pro)
  - Extended: OpenRouter (model marketplace)
  - Specialized: Imagen (image generation)
- **Safety Systems**: Runtime policy evaluation, content filtering

### Execution Environment
- **Sandbox**: Docker containerization with E2B integration
- **Security**: Resource isolation, permission boundaries
- **Capabilities**: Code execution, command-line tools access

---

## Quality Gates & Validation

### Code Quality Assurance
```bash
# Tier 1: Critical Production Tasks
npm run guardrails:check
npm run typecheck
npm run lint  
npm run build

# Tier 2: Quick Development Tasks
npm run guardrails:check
npm run typecheck

# Tier 3: Experimental Tasks
npm run guardrails:check
```

### Testing Framework
- **Unit Tests**: Vitest for component and utility testing
- **Integration Tests**: API route validation, chatbot responses
- **E2E Tests**: Smoke tests, auth regressions, RAG testing
- **Performance Tests**: Load testing, execution service validation

### Code Organization Standards
- **Next.js 16 Requirements**: App Router patterns, modern async APIs
- **Module Boundaries**: Clear separation between domains (chat, auth, builder, etc.)
- **Type Safety**: Strict TypeScript with comprehensive type definitions
- **Import Organization**: Relative imports with clear module boundaries

---

## Security Model Implementation

### Security Headers & Controls
```typescript
// Next.js Security Configuration
headers: [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline'"
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains'
  }
]
```

### Access Control Implementation
- **Guest Access**: Limited functionality with authenticated fallbacks
- **User Tier System**: Free → Trial → Paid progression
- **API Rate Limiting**: Per-minute request quotas
- **Content Filtering**: Input sanitization + output safety checks

### Authentication Flow
```typescript
// Auth Flow Pattern
1. User Request → Better Auth Integration
2. Session Validation → Token Verification  
3. Access Gates → Permission Checking
4. API Access → Authenticated Response
```

### Data Protection
- **User Data**: Encrypted storage at rest
- **API Tokens**: Secure environment variable handling
- **Session Data**: Cookie-based session management
- **Audit Logging**: Compliance tracking for regulatory requirements

---

## Performance & Optimization Systems

### Bundle Analysis
- **Monitoring**: Next.js Bundle Analyzer
- **Budgets**: Defined size limits for critical assets
- **Optimization**: Code splitting, lazy loading, tree shaking

### Runtime Performance
- **Memoization**: React component memoization
- **Virtualization**: Long list optimization
- **Streaming**: Real-time UI updates during AI responses
- **Caching**: API response caching, user preference caching

### Cost Optimization
- **Token Tracking**: Real-time usage monitoring
- **Model Selection**: Dynamic model selection based on complexity
- **Resource Management**: Efficient memory and CPU usage
- **Preview System**: Artifact preview optimization

---

## Monitoring & Observability

### Current Monitoring State
- **In-Memory Metrics**: Stream timing, token counts, response quality
- **Health Check Endpoints**: `/api/health` for system status
- **Audit Logging**: Activity tracking across all features

### Gaps & Planned Improvements
- **Persistent Metrics**: External monitoring service integration
- **Uptime Monitoring**: External service availability checks
- **Log Aggregation**: Centralized logging system
- **Performance Analytics**: User behavior and system performance metrics

### Rate Limiting Implementation
```typescript
// Rate Limiting Pattern
const rateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  max: 20, // requests per window
  keyGenerator: (req) => req.user.id || 'anonymous'
});
```

---

## Development Workflow Tooling

### Code Quality Tools
- **TypeScript**: Strict type checking with noEmit
- **ESLint**: Code linting with Next.js configuration
- **Pre-commit Hooks**: Quality gates before commit
- **Guardrails**: AI content validation system

### Documentation Systems
- **ADR Registry**: `docs/decisions/` for architectural decisions
- **Memory Bank**: `.agents/memory-bank/` for context persistence
- **API Documentation**: Integration guides and examples
- **Component Documentation**: JSDoc usage examples

### Build & Deployment
- **Build System**: Next.js optimized production builds
- **Deployment**: Vercel platform with preview deployments
- **CI/CD**: GitHub Actions for automated testing and validation
- **Environment Management**: Environment-specific configurations

---

## External Integration Architecture

### Third-Party Services
- **Google Workspace**: Document processing and API integrations
- **MCP Protocol**: Tool and service integrations
- **Skills Marketplace**: Extensible capabilities system
- **Payment Processing**: Planned for commercial viability

### API Integration Patterns
- **Proxy System**: Centralized API request handling
- **Error Handling**: Graceful degradation for service failures
- **Rate Limiting**: Per-service request quotas
- **Caching**: Response caching for performance

### Data Exchange Formats
- **JSON API**: Standardized request/response format
- **WebSocket**: Real-time streaming for chat responses
- **File Upload**: Multipart form handling for user uploads

---

## Infrastructure Roadmap

### Short Term (0-4 weeks)
- [ ] Persistent metrics system implementation
- [ ] Enhanced error recovery patterns
- [ ] Performance budget enforcement
- [ ] CI/CD visibility improvements

### Medium Term (1-2 months)  
- [ ] External monitoring service integration
- [ ] Load testing framework implementation
- [ ] Database optimization and scaling
- [ ] Advanced caching strategies

### Long Term (3-6 months)
- [ ] Multi-region deployment architecture
- [ ] Advanced observability platform
- [ ] Performance optimization automation
- [ ] Infrastructure-as-Code implementation
