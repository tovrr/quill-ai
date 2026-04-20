# ARCHITECTURE.md - System Interactions & Component Relationships

**Created:** April 20, 2026 | **Status:** Active Architecture Diagram

---

## System Overview

Quill AI operates as a **modular monorepo** with clear separation of concerns between presentation, business logic, data access, and external integrations. The architecture follows Next.js 16 App Router patterns with decomposed business logic.

---

## Core Component Structure

### Frontend Layer (React)
```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Landing page
│   ├── agent/             # Main chat interface
│   ├── api/               # API route handlers  
│   └── [feature-pages]/   # Feature-specific pages
├── components/            # React UI components
│   ├── ui/               # Shared UI primitives
│   ├── layout/           # Layout components
│   ├── agent/            # Agent-specific UI
│   └── legal/            # Legal/compliance UI
└── lib/                  # Business logic layers
```

### Backend Architecture
```
src/app/api/              # 36 API endpoints
├── chat/                 # Chat endpoints (5 routes)
├── auth/                 # Authentication
├── artifacts/            # Builder system
├── google/               # Google Workspace
├── mcp/                  # Protocol endpoints
└── admin/                # System management

src/lib/                  # Business logic modules
├── chat/                 # Chat backend (5 modules)
├── auth/                 # Authentication logic
├── builder/              # Builder system
├── execution/            # Code execution
├── data/                 # Data access layer
└── observability/        # Monitoring & metrics
```

---

## Component Relationships & Data Flow

### 1. User Interaction Flow
```
User Interface
    ↓ (HTTP Request)
Next.js API Route
    ↓ (Route Handling)
Business Logic Module
    ↓ (Data Processing)
Database Layer
    ↓ (Data Storage)
Response Stream
    ↓ (Real-time Updates)
User Interface Update
```

### 2. Chat System Architecture
```
Chat Route (route.ts)
├── Request Utils → Message parsing/validation
├── Access Gates → Permission checking
├── Model Selection → Model resolution
├── Policy Runtime → Safety evaluation  
└── Two-Pass Builder → Response generation
```

### 3. Builder System Architecture
```
Builder Route
├── Model Selection → Provider resolution
├── Prompt Engineering → Context preparation
├── Two-Pass Process → Reasoning + Generation
├── Artifact Creation → Content storage
└── Canvas Preview → User interface
```

### 4. Authentication Flow
```
User Request
├── Better Auth Integration → Session management
├── Access Gates → Permission checking
├── User Entitlements → Tier validation
└── API Response → Authenticated access
```

---

## Database Schema Relationships

### Core Entity Relationships
```
User (1:N)
├── Sessions (1:N)
├── Chats (1:N)
│   ├── Messages (1:N)
│   └── Artifacts (1:N)
├── UserEntitlements (1:1)
├── ModelUsageEvents (1:N)
└── Skills (1:N)

Autopilot (1:N)
├── Workflows (1:N)
└── Runs (1:N)

MCP Servers (1:N)
└── Tools (1:N)
```

### Data Model Purpose
- **User/Session/Message**: Core chat interaction data
- **Artifacts**: Builder-generated content and versions
- **ModelUsageEvents**: Cost tracking and usage analytics
- **Skills**: Extensibility and third-party integrations
- **Autopilot**: Automated workflow execution
- **MCP**: External tool and service integrations

---

## Module Interactions

### Chat Backend Decomposition
```typescript
// Module Responsibilities
request-utils.ts:    // Parse user input, validate requests
model-selection.ts:   // Resolve models, apply limits
access-gates.ts:     // Check permissions, quotas
policy-runtime.ts:   // Evaluate safety, permissions  
two-pass-builder.ts: // Generate responses, stream output
```

### Data Flow Patterns
```typescript
// Standard Request Pattern
export async function handler(request: Request) {
  // 1. Parse & validate
  const { messages, mode } = parseChatRequestBody(request);
  
  // 2. Check access
  const runtime = evaluatePolicyRuntime({ mode, user });
  
  // 3. Select model  
  const model = resolveModelForMode(mode);
  
  // 4. Generate response
  const response = await buildTwoPassResponse({
    messages, model, runtime
  });
  
  return response;
}
```

### Error Handling Chain
```typescript
// Error Propagation Pattern
try {
  const result = await riskyOperation();
  return successResponse(result);
} catch (error) {
  if (isRecoverable(error)) {
    return fallbackResponse();
  }
  logError(error);
  return errorResponse(error);
}
```

---

## System Integration Points

### 1. External Service Integration
- **Google Workspace**: Document processing, API access
- **MCP Protocol**: Tool extensions and services
- **Skills Marketplace**: User-installed capabilities
- **Execution Service**: Docker sandbox integration

### 2. Cross-Module Communication
```typescript
// Shared Interfaces
interface UserSession {
  userId: string;
  sessionId: string;
  permissions: PermissionSet;
}

interface ChatContext {
  messages: Message[];
  mode: ChatMode;
  user: UserSession;
}

// Module Dependencies
Chat Builder → Model Selection → AI Service → Response Stream
```

### 3. Event-Driven Architecture
```typescript
// System Events
interface SystemEvent {
  type: 'user_message' | 'artifact_created' | 'cost_tracked';
  payload: EventPayload;
  timestamp: Date;
  userId: string;
}

// Event Processing
eventBus.emit('user_message', { message, userId, timestamp });
```

---

## Performance Optimization Patterns

### 1. Component Optimization
- **Memoization**: React component memo for expensive renders
- **Virtualization**: Long list virtualization for message history
- **Streaming**: Real-time updates during AI responses
- **Lazy Loading**: On-demand component loading

### 2. Data Access Optimization
- **Database Indexes**: Optimized queries on frequently accessed data
- **Query Optimization**: Efficient data retrieval patterns
- **Caching**: API response and user preference caching
- **Pagination**: Large dataset handling

### 3. Network Optimization
- **Request Batching**: Multiple operations in single request
- **Compression**: Response compression for faster transfer
- **CDN Integration**: Static asset distribution
- **Connection Pooling**: Database connection reuse

---

## Security Architecture

### 1. Defense in Depth
```
Client Input → Input Validation → API Validation → 
Business Logic → Database Security → Output Sanitization
```

### 2. Access Control Layers
```typescript
// Multi-Layer Permission Check
function checkAccess(user: User, resource: Resource) {
  // 1. Authentication
  if (!isAuthenticated(user)) throw new Error('Unauthenticated');
  
  // 2. Authorization  
  if (!hasPermission(user, resource)) throw new Error('Unauthorized');
  
  // 3. Rate limiting
  if (isRateLimited(user)) throw new Error('Too many requests');
  
  // 4. Feature availability
  if (!isFeatureAvailable(user, resource.feature)) throw new Error('Feature unavailable');
}
```

### 3. Data Security
- **Encryption**: Sensitive data at rest and in transit
- **Token Management**: Secure storage and rotation of API tokens
- **Session Security**: Secure cookie handling and timeout
- **Audit Trails**: Comprehensive activity logging

---

## Testing Architecture

### 1. Test Organization
```
tests/
├── unit/               # Component and utility tests
├── integration/        # API route and feature tests
├── e2e/               # End-to-end user journey tests
└── performance/       # Load and performance tests
```

### 2. Test Data Management
```typescript
// Test Fixture Pattern
const testFixtures = {
  user: createTestUser(),
  session: createTestSession(),
  messages: createTestMessages(),
  models: createTestModels()
};

// Test Data Cleanup
afterEach(async () => {
  await cleanupTestData(testFixtures);
});
```

### 3. Test Coverage Goals
- **Unit Tests**: 80%+ coverage for utilities and helpers
- **Integration Tests**: 100% coverage for API routes
- **E2E Tests**: Critical user journey coverage
- **Security Tests**: Authorization and input validation

---

## Deployment & Infrastructure

### 1. Deployment Architecture
```yaml
# Environment Structure
Production:
  - Vercel deployment with custom domain
  - External monitoring and uptime
  - Production database (Neon)
  - CDN integration

Staging:  
  - Preview deployments for feature branches
  - Test database with sample data
  - Extended logging and metrics

Development:
  - Local development environment
  - Integration with development databases
  - Hot-reload development server
```

### 2. Infrastructure as Code
```typescript
// Infrastructure Configuration
const infrastructure = {
  database: {
    provider: 'neon',
    region: 'eu-central-1',
    backup: true
  },
  cdn: {
    provider: 'vercel',
    edge: true,
    compression: true
  },
  monitoring: {
    uptime: true,
    metrics: true,
    logging: true
  }
};
```

### 3. Scaling Strategy
- **Horizontal Scaling**: Multi-instance deployment strategy
- **Database Scaling**: Read replicas, connection pooling
- **Caching Strategy**: Redis integration for session caching
- **Load Balancing**: Automatic traffic distribution
