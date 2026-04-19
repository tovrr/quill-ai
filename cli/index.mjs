#!/usr/bin/env node
/**
 * Quill AI CLI
 *
 * Usage:
 *   quill                          # interactive REPL
 *   quill "what is quantum computing"  # one-shot query
 *   quill --mode thinking "explain RLHF"
 *   quill --url https://... --key sk-... "hello"
 *
 * Config (in order of priority):
 *   CLI flags:       --url, --key, --mode
 *   Env vars:        QUILL_URL, QUILL_CLI_KEY, QUILL_MODE
 *   Config file:     ~/.quillrc  (JSON: { "url": "...", "key": "...", "mode": "..." })
 */

import { createInterface } from "node:readline";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ─── ANSI helpers ──────────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  quill: "\x1b[38;5;203m", // Quill red
};

const NO_COLOR = process.env.NO_COLOR !== undefined || !process.stdout.isTTY;

function paint(code, text) {
  return NO_COLOR ? text : `${code}${text}${c.reset}`;
}

// ─── Config loading ────────────────────────────────────────────────────────────
function loadRcFile() {
  const rcPath = join(homedir(), ".quillrc");
  if (!existsSync(rcPath)) return {};
  try {
    return JSON.parse(readFileSync(rcPath, "utf8"));
  } catch {
    return {};
  }
}

function parseArgs(argv) {
  const args = { flags: {}, positional: [] };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--url" || arg === "--key" || arg === "--mode") {
      args.flags[arg.slice(2)] = argv[++i] ?? "";
    } else if (arg === "--help" || arg === "-h") {
      args.flags.help = true;
    } else if (arg === "--version" || arg === "-v") {
      args.flags.version = true;
    } else if (!arg.startsWith("-")) {
      args.positional.push(arg);
    }
    i++;
  }
  return args;
}

function printHelp() {
  console.log(`
${paint(c.quill + c.bold, "Quill AI CLI")} ${paint(c.gray, "— your AI agent in the terminal")}

${paint(c.bold, "Usage:")}
  quill                              interactive REPL session
  quill "your question"              one-shot query
  quill --mode thinking "question"   use a specific mode

${paint(c.bold, "Flags:")}
  --url   <url>   API base URL  (default: https://quill-ai-xi.vercel.app)
  --key   <key>   CLI API key   (default: QUILL_CLI_KEY env var or ~/.quillrc)
  --mode  <mode>  fast | thinking | advanced  (default: fast)
  --help          show this help
  --version       show version

${paint(c.bold, "Config file:")}  ~/.quillrc
  ${paint(c.gray, '{ "url": "https://...", "key": "your-key", "mode": "fast" }')}

${paint(c.bold, "Environment variables:")}
  QUILL_URL        API base URL
  QUILL_CLI_KEY    CLI API key
  QUILL_MODE       default mode
`);
}

// ─── SSE parsing ──────────────────────────────────────────────────────────────
async function* parseSSE(readable) {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of readable) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          yield JSON.parse(raw);
        } catch {
          // non-JSON SSE line — skip
        }
      }
    }
  }
}

// ─── Core chat call ──────────────────────────────────────────────────────────
async function chat({ apiUrl, apiKey, messages, mode, onDelta, onDone, onError }) {
  const url = `${apiUrl}/api/cli/chat`;

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ messages, mode }),
    });
  } catch (e) {
    onError(`Network error: ${e.message}\nIs the server running at ${apiUrl}?`);
    return;
  }

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.error ?? JSON.stringify(j);
    } catch {
      detail = await res.text().catch(() => "");
    }
    onError(`Server error ${res.status}: ${detail}`);
    return;
  }

  let fullText = "";
  for await (const event of parseSSE(res.body)) {
    if (event.type === "text") {
      fullText += event.delta;
      onDelta(event.delta);
    } else if (event.type === "done") {
      onDone(fullText, event.usage);
      return;
    } else if (event.type === "error") {
      onError(event.message);
      return;
    }
  }
  onDone(fullText, null);
}

// ─── REPL ─────────────────────────────────────────────────────────────────────
async function runRepl(config) {
  const { apiUrl, apiKey, mode } = config;
  const history = [];

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
  });

  const prompt = paint(c.quill + c.bold, "you") + paint(c.gray, " › ") ;

  console.log(
    paint(c.quill + c.bold, "Quill AI") +
      paint(c.gray, ` — ${mode} mode · ${apiUrl}`) +
      "\n" +
      paint(c.dim, 'Type your message and press Enter. "exit" or Ctrl+C to quit.\n'),
  );

  function ask() {
    rl.question(prompt, async (input) => {
      const text = input.trim();

      if (!text) {
        ask();
        return;
      }

      if (text === "exit" || text === "quit" || text === ".exit") {
        console.log(paint(c.gray, "\nBye!"));
        rl.close();
        process.exit(0);
      }

      if (text === ".clear") {
        history.length = 0;
        console.log(paint(c.gray, "Conversation cleared.\n"));
        ask();
        return;
      }

      if (text === ".mode fast" || text === ".mode thinking" || text === ".mode advanced") {
        config.mode = text.split(" ")[1];
        console.log(paint(c.gray, `Mode set to ${config.mode}.\n`));
        ask();
        return;
      }

      history.push({ role: "user", content: text });

      process.stdout.write("\n" + paint(c.quill + c.bold, "quill") + paint(c.gray, " › "));

      let fullResponse = "";

      await chat({
        apiUrl,
        apiKey,
        messages: history,
        mode: config.mode,
        onDelta(delta) {
          process.stdout.write(delta);
          fullResponse += delta;
        },
        onDone(full) {
          process.stdout.write("\n\n");
          history.push({ role: "assistant", content: full });
          ask();
        },
        onError(msg) {
          process.stdout.write("\n");
          console.error(paint(c.red, `Error: ${msg}\n`));
          // Remove the last user message since the turn failed
          history.pop();
          ask();
        },
      });
    });
  }

  rl.on("SIGINT", () => {
    console.log(paint(c.gray, "\nBye!"));
    process.exit(0);
  });

  ask();
}

// ─── One-shot ──────────────────────────────────────────────────────────────────
async function runOneShot(config, question) {
  const { apiUrl, apiKey, mode } = config;

  await chat({
    apiUrl,
    apiKey,
    messages: [{ role: "user", content: question }],
    mode,
    onDelta(delta) {
      process.stdout.write(delta);
    },
    onDone() {
      process.stdout.write("\n");
    },
    onError(msg) {
      console.error(paint(c.red, `Error: ${msg}`));
      process.exit(1);
    },
  });
}

// ─── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const { flags, positional } = parseArgs(argv);

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  if (flags.version) {
    // Read version from own package.json at runtime
    try {
      const pkgPath = new URL("./package.json", import.meta.url);
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      console.log(pkg.version);
    } catch {
      console.log("1.0.0");
    }
    process.exit(0);
  }

  const rc = loadRcFile();

  const apiUrl = (flags.url ?? process.env.QUILL_URL ?? rc.url ?? "https://quill-ai-xi.vercel.app").replace(
    /\/$/,
    "",
  );
  const apiKey = flags.key ?? process.env.QUILL_CLI_KEY ?? rc.key ?? "";
  const mode = flags.mode ?? process.env.QUILL_MODE ?? rc.mode ?? "fast";

  if (!apiKey) {
    console.error(
      paint(c.red, "Error: No CLI key provided.\n") +
        paint(
          c.dim,
          "Set QUILL_CLI_KEY env var, pass --key <key>, or add \"key\" to ~/.quillrc\n" +
            "The server must also have QUILL_CLI_KEY set to the same value.",
        ),
    );
    process.exit(1);
  }

  const config = { apiUrl, apiKey, mode };

  const question = positional.join(" ").trim();
  if (question) {
    await runOneShot(config, question);
  } else {
    await runRepl(config);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
