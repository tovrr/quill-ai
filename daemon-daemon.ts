// Minimal Node.js daemon skeleton for Quil AI agent runtime manager
// Save as daemon-daemon.ts
import fs from "fs";
import path from "path";
import axios from "axios";

interface AgentCLI {
  name: string;
  path: string;
  provider: string;
  metadata?: Record<string, any>;
}

interface DaemonConfig {
  serverUrl: string;
  heartbeatIntervalSec: number;
  agentCLIs: AgentCLI[];
}

const CONFIG_PATH = path.resolve(__dirname, "daemon.config.json");

function loadConfig(): DaemonConfig {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

async function registerAgent(agent: AgentCLI, serverUrl: string) {
  try {
    await axios.post(`${serverUrl}/register`, {
      name: agent.name,
      provider: agent.provider,
      path: agent.path,
      metadata: agent.metadata || {},
    });
    console.log(`[REGISTERED] ${agent.name}`);
  } catch (err) {
    console.error(`[REGISTER FAIL] ${agent.name}:`, err.message);
  }
}

async function heartbeatAgent(agent: AgentCLI, serverUrl: string) {
  try {
    await axios.post(`${serverUrl}/heartbeat`, {
      name: agent.name,
      provider: agent.provider,
    });
    // console.log(`[HEARTBEAT] ${agent.name}`);
  } catch (err) {
    console.error(`[HEARTBEAT FAIL] ${agent.name}:`, err.message);
  }
}

async function deregisterAgent(agent: AgentCLI, serverUrl: string) {
  try {
    await axios.delete(`${serverUrl}/${encodeURIComponent(agent.name)}`);
    console.log(`[DEREGISTERED] ${agent.name}`);
  } catch (err) {
    console.error(`[DEREGISTER FAIL] ${agent.name}:`, err.message);
  }
}

async function main() {
  const config = loadConfig();
  const agents = config.agentCLIs;
  const serverUrl = config.serverUrl;

  // Register all agents
  await Promise.all(agents.map((agent) => registerAgent(agent, serverUrl)));

  // Heartbeat interval
  const interval = setInterval(() => {
    agents.forEach((agent) => heartbeatAgent(agent, serverUrl));
  }, config.heartbeatIntervalSec * 1000);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    clearInterval(interval);
    await Promise.all(agents.map((agent) => deregisterAgent(agent, serverUrl)));
    process.exit(0);
  });
}

main();
