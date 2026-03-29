declare module "@ai-sdk/react" {
  import type { UIMessage } from "ai";

  type ChatStatus = "ready" | "submitted" | "streaming" | "error" | string;

  type SendMessageInput = {
    text: string;
    files?: FileList | unknown[];
  };

  type UseChatHelpers<UI_MESSAGE extends UIMessage = UIMessage> = {
    id: string;
    messages: UI_MESSAGE[];
    status: ChatStatus;
    error?: Error;
    sendMessage: (message: SendMessageInput) => Promise<void>;
    setMessages: (
      messages: UI_MESSAGE[] | ((messages: UI_MESSAGE[]) => UI_MESSAGE[])
    ) => void;
    stop: () => void;
    clearError: () => void;
  };

  export function useChat<UI_MESSAGE extends UIMessage = UIMessage>(
    options?: Record<string, unknown>
  ): UseChatHelpers<UI_MESSAGE>;
}
