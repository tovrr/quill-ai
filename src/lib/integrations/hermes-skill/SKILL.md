# Quill Mission Inbox — Hermes Skill

## What This Skill Does

Automatically syncs every significant Hermes session into the **Quill Mission Inbox** at https://your-quill-domain/missions.
After completing a task or conversation on any channel (Telegram, Discord, Slack, WhatsApp, Signal, Email…), Hermes calls the Quill ingest API so you can see all your agent activity in one place.

This skill also lets Hermes read and search your Quill chat history via the Quill MCP server.

---

## Setup (2 minutes)

### 1. Generate a Quill API Key

1. Open your Quill dashboard → **Settings → API Keys**
2. Click **Generate new key** → copy the key (shown once)
3. Store it as an environment variable on the machine running Hermes:
   ```bash
   # add to ~/.bashrc, ~/.zshrc, or your Hermes .env file
   export QUILL_API_KEY="qak_your_key_here"
   export QUILL_BASE_URL="https://your-quill-domain.vercel.app"
   ```

### 2. Install the Skill

```bash
mkdir -p ~/.hermes/skills/quill-inbox
cp SKILL.md ~/.hermes/skills/quill-inbox/SKILL.md
```

Or from your Quill dashboard (if the skill is served from there):
```bash
hermes skill install $QUILL_BASE_URL/skills/hermes/quill-inbox
```

### 3. Connect Hermes to the Quill MCP Server (optional but recommended)

Add Quill as an MCP server so Hermes can *read* your mission history:

```yaml
# ~/.hermes/config.yaml  (or equivalent config file)
mcp_servers:
  - name: quill
    url: "${QUILL_BASE_URL}/api/agent/mcp"
    auth: "Bearer ${QUILL_API_KEY}"
    description: "Quill Mission Inbox — list, search and create missions"
```

Then restart: `hermes reload`

---

## Behavior (When Hermes Should Trigger This Skill)

**ALWAYS call `send_session` (or POST to the ingest endpoint) when:**

- A multi-turn conversation ends or goes idle for > 5 minutes
- A task is marked as done, completed, or resolved
- A file, document, or code artefact is delivered to the user
- A scheduled job or cron task finishes execution
- The user explicitly says "save this", "log this", or "remember this"

**DO NOT call this skill for:**
- Single-message exchanges with no notable output
- Internal agent reasoning steps
- Health checks or ping messages

---

## API Reference

### Option A — Use the Quill MCP Tool (if MCP server is configured)

```python
# Hermes will call this automatically when the MCP server is connected
await mcp.call("quill", "send_session", {
    "title": "Summary of what was done",
    "source": "hermes",
    "summary": "Detailed description of the session output",
    "sourceId": str(session_id),          # optional: your internal session ID
    "externalUrl": "https://...",          # optional: deep link back to the conversation
    "metadata": {"channel": "telegram", "user_id": user_id}  # optional
})
```

### Option B — Direct HTTP POST (no MCP needed)

```python
import os, httpx

async def push_to_quill(title: str, summary: str, source: str = "hermes", **kwargs):
    key = os.environ.get("QUILL_API_KEY")
    base = os.environ.get("QUILL_BASE_URL", "https://app.quill.ai")
    if not key:
        return  # skip silently if not configured

    await httpx.AsyncClient().post(
        f"{base}/api/missions/ingest",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"title": title, "source": source, "summary": summary, **kwargs},
        timeout=8.0,
    )
```

Call `push_to_quill` at the end of each session handler in `hermes_state.py` or your session completion hook.

---

## Integration Hook (hermes_state.py)

If you want fully automatic syncing, add this to your Hermes session lifecycle:

```python
# hermes_state.py — add to session completion handler
from quill_skill import push_to_quill  # or paste the function above

async def on_session_complete(session):
    await push_to_quill(
        title=session.title or session.last_message[:80],
        summary=session.summary or session.transcript[-1000:],
        source="hermes",
        sourceId=str(session.id),
        metadata={"channel": session.channel, "user": session.user_id},
    )
```

---

## Reading Missions Back (MCP Tools Available)

When connected via MCP, Hermes can call:

| Tool | What it does |
|------|-------------|
| `list_missions` | List all sessions (Quill + external agents), filter by source |
| `send_session` | Push a session into the inbox |
| `get_mission` | Get details for a specific mission by ID |
| `new_chat_url` | Get URL to open a new Quill chat |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `QUILL_API_KEY` not set | Set env var or check Settings → API Keys |
| 401 Unauthorized | Regenerate key — keys are shown once only |
| 503 from ingest | Check your Quill deployment is running |
| Sessions not appearing | Confirm `source` is one of: `hermes telegram gmail notion slack openclaw agent custom` |

---

## ACP Integration (Advanced)

Hermes supports the [Agent Communication Protocol (ACP)](https://acp.dev).
To register Quill as an ACP peer:

```yaml
# ~/.hermes/acp_registry.yaml
peers:
  - id: quill-inbox
    endpoint: "${QUILL_BASE_URL}/api/agent/mcp"
    auth: "Bearer ${QUILL_API_KEY}"
    capabilities: [missions.list, missions.create, missions.get]
```

Then Hermes can route delegation requests to Quill automatically.
