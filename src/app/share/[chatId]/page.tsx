import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon, PlusIcon } from "@heroicons/react/24/outline";
import { getChatById, getMessagesByChatId } from "@/lib/data/db-helpers";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";

interface Props {
  params: Promise<{ chatId: string }>;
}

function MessageBubble({
  role,
  content,
}: {
  role: string;
  content: string;
}) {
  const isUser = role === "user";

  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      {isUser ? (
        <div className="w-7 h-7 rounded-full bg-linear-to-br from-[#F87171] to-[#F87171] flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5">
          U
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full bg-quill-surface border border-quill-border flex items-center justify-center shrink-0 mt-0.5">
          <QuillLogo size={15} />
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "rounded-tr-sm bg-[#EF4444] text-white"
            : "rounded-tl-sm bg-quill-surface border border-quill-border text-quill-text"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

export default async function SharePage({ params }: Props) {
  const { chatId } = await params;

  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!sessionData?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/share/${chatId}`)}`);
  }

  let chat;
  let msgs: Awaited<ReturnType<typeof getMessagesByChatId>> = [];

  try {
    chat = await getChatById(chatId);
    if (chat) {
      msgs = await getMessagesByChatId(chatId);
    }
  } catch {
    // DB not available or chat not found
  }

  if (!chat || chat.userId !== sessionData.user.id) {
    notFound();
  }

  const visibleMessages = msgs.filter(
    (m) => m.role === "user" || m.role === "assistant"
  );

  return (
    <div className="min-h-screen bg-quill-bg flex flex-col">
      {/* Top banner */}
      <div className="border-b border-quill-border bg-[#0d0d15] shrink-0">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <QuillLogo size={20} />
            <span className="text-sm font-semibold gradient-text">Quill AI</span>
            <span className="text-quill-border-2">·</span>
            <span className="text-xs text-quill-muted">Shared conversation</span>
          </div>
          <Link
            href="/agent"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-medium transition-all"
          >
            <PlusIcon className="h-3 w-3" />
            Try Quill AI
          </Link>
        </div>
      </div>

      {/* Chat title */}
      <div className="max-w-3xl mx-auto w-full px-6 pt-8 pb-4">
        <h1 className="text-lg font-semibold text-quill-text">{chat.title}</h1>
        <p className="text-xs text-quill-muted mt-1">
          {visibleMessages.length} message{visibleMessages.length !== 1 ? "s" : ""}
          {chat.createdAt && (
            <>
              {" "}· {new Date(chat.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </>
          )}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 pb-12 space-y-5">
        {visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-quill-surface border border-quill-border flex items-center justify-center">
              <QuillLogo size={24} />
            </div>
            <p className="text-sm text-quill-muted">No messages in this conversation.</p>
          </div>
        ) : (
          visibleMessages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))
        )}
      </div>

      {/* Footer CTA */}
      <div className="border-t border-quill-border bg-[#0d0d15] shrink-0">
        <div className="max-w-3xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-quill-text">Continue this conversation in Quill AI</p>
            <p className="text-xs text-quill-muted mt-0.5">Your personal AI agent for research, code, writing, and more.</p>
          </div>
          <Link
            href="/agent"
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-medium transition-all shadow-lg shadow-[rgba(239,68,68,0.3)]"
          >
            Start chatting
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
