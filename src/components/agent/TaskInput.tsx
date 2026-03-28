"use client";

import { useState, useRef, useEffect } from "react";

export type Mode = "fast" | "thinking" | "advanced";

interface TaskInputProps {
  onSend: (message: string, files?: FileList) => void;
  onGenerateImage?: (prompt: string) => Promise<void>;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  disabled?: boolean;
  isGeneratingImage?: boolean;
  placeholder?: string;
}

const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: "fast", label: "Fast", desc: "Quill Flash — quick responses" },
  { id: "thinking", label: "Think", desc: "Quill Think — deep reasoning" },
  { id: "advanced", label: "Pro", desc: "Quill Pro — best quality" },
];

const FEATURE_CHIPS = [
  "Fast responses",
  "Deep reasoning",
  "File upload",
  "Image generation",
  "Canvas view",
];

export function TaskInput({
  onSend,
  onGenerateImage,
  mode,
  onModeChange,
  disabled,
  isGeneratingImage,
  placeholder,
}: TaskInputProps) {
  const [value, setValue] = useState("");
  const [imageMode, setImageMode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileList | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        160
      )}px`;
    }
  }, [value]);

  const isDisabled = disabled || isGeneratingImage;

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;

    if (imageMode && onGenerateImage) {
      await onGenerateImage(trimmed);
      setValue("");
      setImageMode(false);
    } else {
      onSend(trimmed, attachedFiles ?? undefined);
      setValue("");
      setAttachedFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachedFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    if (!attachedFiles) return;
    const dt = new DataTransfer();
    Array.from(attachedFiles).forEach((f, i) => {
      if (i !== index) dt.items.add(f);
    });
    setAttachedFiles(dt.files.length > 0 ? dt.files : null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleImageMode = () => {
    setImageMode((m) => !m);
    setAttachedFiles(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const currentPlaceholder = imageMode
    ? "Describe the image you want to generate..."
    : placeholder ?? "Ask Quill to do anything...";

  return (
    <div className="flex flex-col gap-3">
      {/* Input area */}
      <div
        className="glow-border rounded-2xl bg-[#111118] transition-all duration-200 focus-within:border-[rgba(124,106,247,0.6)] focus-within:shadow-[0_0_24px_rgba(124,106,247,0.15)]"
        style={
          imageMode
            ? { borderColor: "rgba(124,106,247,0.5)", boxShadow: "0 0 20px rgba(124,106,247,0.1)" }
            : {}
        }
      >
        {/* Attached file chips */}
        {attachedFiles && attachedFiles.length > 0 && (
          <div className="px-4 pt-3 flex flex-wrap gap-2">
            {Array.from(attachedFiles).map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1e1e2e] border border-[#2a2a3e] text-xs text-[#a8a8c0]"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                <span className="max-w-[100px] truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="ml-0.5 text-[#6b6b8a] hover:text-[#e8e8f0] transition-colors"
                  aria-label="Remove file"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Image mode badge */}
        {imageMode && (
          <div className="px-4 pt-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(124,106,247,0.15)] border border-[rgba(124,106,247,0.3)] text-xs text-[#a78bfa] font-medium">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Image generation mode
            </span>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          placeholder={currentPlaceholder}
          rows={1}
          className="w-full bg-transparent resize-none px-5 py-4 text-sm text-[#e8e8f0] placeholder-[#6b6b8a] outline-none leading-relaxed"
          style={{ minHeight: "52px" }}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 pb-3 pt-0">
          {/* Left: file + image gen buttons */}
          <div className="flex items-center gap-1">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              multiple
              accept="image/*,.pdf,.txt,.md,.csv,.json,.docx,.xlsx"
            />

            {/* Attach file */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isDisabled || imageMode}
              title="Attach file"
              className="p-1.5 rounded-lg text-[#6b6b8a] hover:text-[#e8e8f0] hover:bg-[#1e1e2e] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            {/* Image generation toggle */}
            {onGenerateImage && (
              <button
                onClick={toggleImageMode}
                disabled={isDisabled}
                title={imageMode ? "Exit image mode" : "Generate image"}
                className={`p-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  imageMode
                    ? "text-[#a78bfa] bg-[rgba(124,106,247,0.12)] hover:bg-[rgba(124,106,247,0.2)]"
                    : "text-[#6b6b8a] hover:text-[#e8e8f0] hover:bg-[#1e1e2e]"
                }`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>
            )}
          </div>

          {/* Right: mode pills + send */}
          <div className="flex items-center gap-2">
            {/* Mode selector */}
            <div className="flex items-center p-0.5 rounded-xl bg-[#0d0d15] border border-[#1e1e2e]">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onModeChange(m.id)}
                  disabled={isDisabled}
                  title={m.desc}
                  className={`px-2.5 py-1 rounded-[10px] text-[11px] font-medium transition-all duration-150 disabled:cursor-not-allowed ${
                    mode === m.id
                      ? "bg-[#7c6af7] text-white shadow-sm"
                      : "text-[#6b6b8a] hover:text-[#a8a8c0]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Send / Generate button */}
            <button
              onClick={handleSend}
              disabled={!value.trim() || isDisabled}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shadow-md ${
                imageMode
                  ? "bg-[#a78bfa] hover:bg-[#9370f0] shadow-[rgba(167,139,250,0.3)]"
                  : "bg-[#7c6af7] hover:bg-[#6b58e8] shadow-[rgba(124,106,247,0.3)]"
              }`}
            >
              {isGeneratingImage ? (
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                </svg>
              ) : imageMode ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="text-center text-[11px] text-[#6b6b8a]">
        <kbd className="px-1 py-0.5 rounded bg-[#1e1e2e] text-[#a8a8c0] text-[10px] font-mono">
          Enter
        </kbd>{" "}
        to send &middot;{" "}
        <kbd className="px-1 py-0.5 rounded bg-[#1e1e2e] text-[#a8a8c0] text-[10px] font-mono">
          Shift+Enter
        </kbd>{" "}
        for new line
        {imageMode && (
          <span className="ml-2 text-[#7c6af7]">· Image generation active</span>
        )}
      </p>

      {/* Feature chips — shown below input when idle */}
      {!value && !isDisabled && !imageMode && !attachedFiles && (
        <div className="flex flex-wrap gap-2 justify-center">
          {FEATURE_CHIPS.map((label) => (
            <span
              key={label}
              className="text-[12px] px-3 py-1.5 rounded-full border border-[#1e1e2e] text-[#6b6b8a]"
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
