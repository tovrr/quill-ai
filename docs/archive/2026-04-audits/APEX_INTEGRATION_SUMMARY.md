# Apex Integration - Diffs & Deployment

## 📋 Fichiers Créés

### 1. `lib/apex-client.ts` (Nouveau)
**Rôle:** Client interne pour appels Apex côté serveur  
**Sécurité:** La clé API est injectée côté serveur uniquement

**Fonctions principales:**
- `callApexChat(req)` → Appel synchrone à `/chat`
- `streamApexChat(req)` → Stream SSE depuis `/chat/stream`
- Validation d'entrées (question obligatoire, mots_max: 1-500)
- Gestion timeouts avec AbortController
- Erreurs typées avec `ApexClientError`

---

### 2. `app/api/apex/chat/route.ts` (Nouveau)
**Rôle:** Route de proxy POST `/api/apex/chat`  
**Endpoint:** Synchrone, retourne JSON

**Spec:**
```
POST /api/apex/chat
Content-Type: application/json

Request:
{
  "question": "What is Python?",
  "mots_max": 100,
  "context": { "language": "en" }
}

Response (200):
{
  "response": "Python is...",
  "usage": { "prompt_tokens": 12, "completion_tokens": 45 }
}

Error (400):
{
  "error": "Invalid request",
  "details": { "fieldErrors": [...] }
}
```

**Validation:**
- `question` (string, required, non-vide)
- `mots_max` (integer, 1-500, optional)
- `context` (object, optional)

---

### 3. `app/api/apex/stream/route.ts` (Nouveau)
**Rôle:** Route de proxy POST `/api/apex/stream`  
**Endpoint:** Server-Sent Events (SSE), streaming

**Spec:**
```
POST /api/apex/stream
Content-Type: application/json

Request: (identique à /chat)
{
  "question": "Tell a story",
  "mots_max": 200
}

Response (200 OK):
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: First chunk of response...
data: Second chunk...
data: Final chunk...
```

**Streaming:**
- Passe le ReadableStream d'Apex directement au client
- Pas de buffering
- Headers SSE configurés pour CORS

---

### 4. `.env.local.example` (Nouveau)
**Rôle:** Template de configuration (à copier en `.env.local`)

```bash
# Apex API Configuration
APEX_BASE_URL=https://392he1rvqgzavc-8000.proxy.runpod.net
APEX_SECRET_KEY=apex-your-secret-key-here
APEX_ALLOW_ANON_PROXY=0

# Auth (NextAuth)
NEXTAUTH_SECRET=dev-secret-key-change-in-production
NEXTAUTH_URL=http://localhost:3000
```

**⚠️ Important:** Ne jamais commiter `.env.local` (contient secrets)

---

### 5. `APEX_INTEGRATION_TESTING.md` (Nouveau)
**Rôle:** Guide complet de test  
**Contient:**
- Tests manuels (curl, JavaScript)
- Script PowerShell d'intégration
- Vérifications de sécurité (pas de clé exposée)
- Checklist pre-production

---

## 🔐 Sécurité Vérifiée

✅ **API Key:** Injectée uniquement côté serveur (env var `APEX_SECRET_KEY`)  
✅ **DevTools:** Aucune clé ne traversera le réseau client-server  
✅ **Headers:** Authorization envoyé UNIQUEMENT au backend Apex  
✅ **Validation:** Input sanitization (Zod) + range checks  
✅ **Timeouts:** AbortController pour éviter les hangs  

---

## 🚀 Commandes Quick-Start

### 1. Configuration Initiale
```bash
# Copier le template env
cp .env.local.example .env.local

# Éditer avec vos credentials
# APEX_SECRET_KEY=apex-votre-clé-secrète
```

### 2. Vérification TypeScript
```bash
npm run typecheck
# ✅ Doit passer sans erreur
```

### 3. Build
```bash
npm run build
# ✅ Doit succéder
```

### 4. Développement Local
```bash
npm run dev
# 🚀 Server sur http://localhost:3000
```

### 5. Test Chat Endpoint
```bash
curl -X POST http://localhost:3000/api/apex/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is TypeScript?",
    "mots_max": 100
  }'
```

### 6. Test Stream Endpoint
```bash
curl -X POST http://localhost:3000/api/apex/stream \
  -H "Content-Type: application/json" \
  -d '{"question": "Explain recursion", "mots_max": 150}' \
  -N
  # -N: no buffering, stream in real-time
```

### 7. Run Full Test Suite
```powershell
.\test-apex-integration.ps1
# Exécute tous les tests (chat, stream, validation, security)
```

---

## 📊 Résumé Fichiers Modifiés

| Fichier | Type | Lignes | Description |
|---------|------|--------|-------------|
| `lib/apex-client.ts` | **NEW** | ~200 | Client Apex server-side |
| `app/api/apex/chat/route.ts` | **NEW** | ~75 | Proxy chat synchrone |
| `app/api/apex/stream/route.ts` | **NEW** | ~75 | Proxy stream SSE |
| `.env.local.example` | **NEW** | ~11 | Template configuration |
| `APEX_INTEGRATION_TESTING.md` | **NEW** | ~350 | Guide complet test |

**Total:** 5 fichiers créés, ~700 lignes de code + tests

---

## ✅ Checklist Intégration Frontend

Pour adapter votre frontend Quill:

### Avant (Direct Apex - ❌ Clé Exposée)
```typescript
const apexKey = process.env.REACT_APP_APEX_KEY; // ❌ EXPOSÉ
const apexUrl = process.env.REACT_APP_APEX_URL;

const response = await fetch(`${apexUrl}/chat`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apexKey}`, // ❌ EN CLAIR
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ question })
});
```

### Après (Via Proxy - ✅ Sécurisé)
```typescript
const response = await fetch("/api/apex/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question })
  // ✅ Pas de clé, pas d'URL Apex directe
});

if (!response.ok) {
  const { error, status } = await response.json();
  console.error(`Apex error: ${status}`, error);
  // Handle: 400, 401, 502, 504, 500
}

const { response: answer } = await response.json();
```

### Stream (Frontend)
```typescript
// Before: direct fetch avec streaming
const eventSource = new EventSource(
  `${apexUrl}/chat/stream`,
  { headers: { "Authorization": `Bearer ${apexKey}` } } // ❌ NOT VALID
);

// After: via proxy
const response = await fetch("/api/apex/stream", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question })
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader!.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  console.log("Streamed:", chunk);
}
```

---

## 🔍 Vérifications Pre-Production

- [ ] `npm run typecheck` ✅ (zéro erreur)
- [ ] `npm run build` ✅ (build réussit)
- [ ] `.env.local` configuré avec vraies credentials
- [ ] Chat endpoint testé (curl ou Postman)
- [ ] Stream endpoint testé (DevTools Network)
- [ ] DevTools: aucune clé Apex en Network, Storage, Console
- [ ] Frontend refactorisé pour utiliser `/api/apex/*`
- [ ] Erreur 401, 502, timeout gérées côté frontend
- [ ] Monitoring: logs d'erreur Apex en production

---

## ⚠️ Troubleshooting

| Problème | Cause | Solution |
|----------|-------|----------|
| 502 Bad Gateway | Backend Apex unreachable | Vérifier `APEX_BASE_URL` et connectivité RunPod |
| 400 Bad Request | JSON invalide | Vérifier payload (question obligatoire) |
| Clé exposée en DevTools | Env publique | `REACT_APP_*` → faire via `/api/apex` proxy |
| Timeout lors stream | Backend lent | Augmenter `maxDuration` (defaut: 300s) |
| TypeScript errors | Cache .next | `rm -r .next && npm run typecheck` |
| CORS errors | Headers manquants | Vérifier `Access-Control-Allow-*` dans stream route |

---

## 📚 Architecture Overview

```
Frontend (Quill)
    ↓
POST /api/apex/chat
    ↓ (server-side)
[Next.js Route Handler]
    ├─ Valide input (Zod)
    ├─ Charge APEX_SECRET_KEY (env)
    ├─ Appelle callApexChat()
    └─ Retourne JSON
    ↓ (server-side)
lib/apex-client.ts
    ├─ Injécte Authorization header
    └─ POST https://apex-backend/chat
         ↓
    [Apex Backend]
         ↓
    Retourne response
```

---

## 📖 Documentation

- **Testing:** [APEX_INTEGRATION_TESTING.md](./APEX_INTEGRATION_TESTING.md)
- **Config:** [.env.local.example](.env.local.example)
- **API Client:** [lib/apex-client.ts](./src/lib/apex-client.ts)

