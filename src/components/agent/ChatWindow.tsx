"use client";

import { useEffect, useRef } from "react";
import { MessageBubble, type Message } from "@/components/agent/MessageBubble";

interface ChatWindowProps {
  messages: Message[];
  isTyping?: boolean;
}

export function ChatWindow({ messages, isTyping }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isTyping && <MessageBubble isTyping />}
      <div ref={bottomRef} />
    </div>
  );
}
