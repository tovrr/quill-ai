import { type Message } from "@/components/agent/MessageBubble";
import { type ToolCall } from "@/components/agent/ToolCallCard";

// Tool icons as plain strings — components use them as ReactNode
export const TOOL_ICONS = {
  search: `search`,
  browser: `browser`,
  code: `code`,
  file: `file`,
  email: `email`,
  write: `write`,
  analyze: `analyze`,
};

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

interface SimulatedResponse {
  toolCalls: ToolCall[];
  content: string;
}

// Returns a simulated multi-step response based on user input
export function simulateAgentResponse(userMessage: string): SimulatedResponse {
  const lower = userMessage.toLowerCase();

  if (lower.includes("research") || lower.includes("find") || lower.includes("competitor")) {
    return {
      toolCalls: [
        {
          id: makeId(),
          tool: "Web Search",
          description: `Searching: "${userMessage.slice(0, 50)}..."`,
          status: "done",
          icon: null,
          result: `Found 12 relevant results.\n\n1. TechCrunch — AI Companies to Watch in 2026\n2. Forbes — Top AI Startups Funding Rounds\n3. Crunchbase — Market Intelligence Data\n4. Product Hunt — New AI Tools Launch\n...`,
        },
        {
          id: makeId(),
          tool: "Browser",
          description: "Reading top results and extracting key data",
          status: "done",
          icon: null,
          result: `Extracted structured data from 4 sources.\nKey competitors identified: Manus AI, Claude, Gemini Pro, GPT-4o.\nMarket size estimate: $42B by 2027.`,
        },
        {
          id: makeId(),
          tool: "Analyze",
          description: "Synthesizing findings into a structured report",
          status: "done",
          icon: null,
          result: `Analysis complete. 847 words of structured content generated.`,
        },
      ],
      content: `I've completed the research. Here's a summary:\n\n**Top findings:**\n- The AI agent market is growing at 38% CAGR through 2027\n- Key players: Manus AI, AutoGPT, Claude Opus, GPT-4o Turbo\n- Differentiation opportunities: real-time data, long-horizon tasks, tool integration\n- Most tools lack robust memory and multi-step planning\n\nWould you like me to create a full competitive analysis document or dive deeper into any specific competitor?`,
    };
  }

  if (lower.includes("write") || lower.includes("blog") || lower.includes("email") || lower.includes("draft")) {
    return {
      toolCalls: [
        {
          id: makeId(),
          tool: "Analyze Context",
          description: "Understanding the writing task requirements",
          status: "done",
          icon: null,
          result: "Task type: Long-form writing\nTone: Professional\nTarget audience: General / Business",
        },
        {
          id: makeId(),
          tool: "Write",
          description: "Generating content with structured outline",
          status: "done",
          icon: null,
          result: "Generated 1,240 words across 5 sections.",
        },
      ],
      content: `Here's the content I drafted for you:\n\n**Title: The Rise of AI Agents in 2026**\n\nArtificial intelligence has crossed a critical threshold. No longer confined to answering questions, today's AI agents plan, execute, and adapt — autonomously completing complex tasks that once required entire teams.\n\nIn this post, we explore how AI agents like Quill are reshaping personal productivity, what separates the best from the rest, and what the next 12 months hold for this explosive space.\n\n*[Full draft continues — 1,240 words total]*\n\nWant me to refine the tone, add more sections, or export this as a formatted document?`,
    };
  }

  if (lower.includes("code") || lower.includes("build") || lower.includes("create") || lower.includes("page")) {
    return {
      toolCalls: [
        {
          id: makeId(),
          tool: "Code",
          description: "Planning component architecture",
          status: "done",
          icon: null,
          result: "Planned 4 components: Layout, Hero, Features, CTA\nEstimated: 180 lines of code",
        },
        {
          id: makeId(),
          tool: "Write File",
          description: "Writing component code with TypeScript + Tailwind",
          status: "done",
          icon: null,
          result: "Created:\n- components/LandingPage.tsx (94 lines)\n- components/Hero.tsx (42 lines)\n- components/FeatureGrid.tsx (38 lines)",
        },
      ],
      content: `I've built the landing page components. Here's an overview of what was created:\n\n\`\`\`tsx\n// Hero section with animated gradient\nexport function Hero() {\n  return (\n    <section className="flex flex-col items-center py-24">\n      <h1 className="text-6xl font-bold gradient-text">\n        Build Faster with AI\n      </h1>\n      <p className="mt-4 text-xl text-muted max-w-lg text-center">\n        Quill handles the complexity so you can focus on ideas.\n      </p>\n    </section>\n  );\n}\n\`\`\`\n\nAll 3 components are ready. Want me to add animations, integrate real data, or adjust the design?`,
    };
  }

  if (lower.includes("analyz") || lower.includes("summar") || lower.includes("csv") || lower.includes("data")) {
    return {
      toolCalls: [
        {
          id: makeId(),
          tool: "File Reader",
          description: "Reading and parsing the provided data",
          status: "done",
          icon: null,
          result: "Parsed 2,847 rows × 12 columns\nDate range: Jan 2025 – Mar 2026\nKey columns: Revenue, Users, Churn, CAC, LTV",
        },
        {
          id: makeId(),
          tool: "Analyze",
          description: "Running statistical analysis and pattern detection",
          status: "done",
          icon: null,
          result: "Completed:\n- Trend analysis (MoM growth: +12.4%)\n- Anomaly detection (3 outliers found)\n- Cohort analysis across 6 segments\n- Churn prediction model (R²: 0.87)",
        },
      ],
      content: `Analysis complete. Key insights:\n\n**Revenue**\n- Total Q1 2026: $284,000 (+18% vs Q4 2025)\n- Best month: March 2026 ($102k)\n\n**User Growth**\n- MAU: 12,400 (+8.3% MoM)\n- Churn rate dropped from 4.2% → 2.8%\n\n**Anomaly Detected**\n- Feb 14: Revenue spike +340% (Valentine's Day promo)\n- March 3: Sudden churn spike — correlates with pricing page change\n\n**Recommendation:** Revert pricing page A/B test — high statistical confidence (p<0.01).\n\nWant a full PDF report or a breakdown by segment?`,
    };
  }

  // Default generic response
  return {
    toolCalls: [
      {
        id: makeId(),
        tool: "Think",
        description: "Planning approach to this task",
        status: "done",
        icon: null,
        result: "Task categorized. Approach: Direct response with supporting context.",
      },
    ],
    content: `I understand you want to: **${userMessage}**\n\nI've thought through the best approach for this. Here's how I can help:\n\n1. Break this into clear subtasks\n2. Execute each step systematically\n3. Provide structured results with sources\n\nShall I proceed, or would you like to refine the task first? I can also outline exactly what steps I'll take before starting.`,
  };
}

export function createUserMessage(content: string): Message {
  return {
    id: makeId(),
    role: "user",
    content,
    timestamp: new Date(),
  };
}

export function createAssistantMessage(response: SimulatedResponse): Message {
  return {
    id: makeId(),
    role: "assistant",
    content: response.content,
    toolCalls: response.toolCalls,
    timestamp: new Date(),
  };
}
