# REST API Spec for Quil AI Runtime Management

## Base URL

`/api/runtimes`

---

### 1. Register or Update a Runtime

- **POST** `/api/runtimes/register`
- **Body:**

```json
{
  "name": "Hermes",
  "provider": "HermesAI",
  "path": "C:/agents/hermes.exe",
  "metadata": { "version": "1.0.0" }
}
```

- **Response:**

```json
{
  "id": "runtime-uuid",
  "status": "registered"
}
```

---

### 2. Heartbeat

- **POST** `/api/runtimes/heartbeat`
- **Body:**

```json
{
  "name": "Hermes",
  "provider": "HermesAI"
}
```

- **Response:**

```json
{
  "status": "ok"
}
```

---

### 3. List All Runtimes

- **GET** `/api/runtimes`
- **Response:**

```json
[
  {
    "id": "runtime-uuid",
    "name": "Hermes",
    "provider": "HermesAI",
    "status": "online",
    "last_seen_at": "2026-04-22T12:00:00Z",
    "metadata": { "version": "1.0.0" }
  }
]
```

---

### 4. Deregister a Runtime

- **DELETE** `/api/runtimes/:id`
- **Response:**

```json
{
  "status": "deregistered"
}
```

---

### 5. (Optional) Capabilities Extension

- Add a `capabilities` field to runtime objects:

```json
{
  "capabilities": ["text-generation", "tool-use"]
}
```

---

## Notes

- All endpoints expect and return JSON.
- Auth (API keys/JWT) can be added as needed.
- Heartbeat interval and offline sweeper logic should be handled server-side.
