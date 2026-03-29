import { useId } from "react";

export function QuillLogo({ size = 28 }: { size?: number }) {
  const uid = useId();
  const id = `quill-grad-${uid.replace(/:/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
      {/* Feather quill shape */}
      <path
        d="M26 4C20 4 10 10 8 24L12 20C14 14 20 10 26 4Z"
        fill={`url(#${id})`}
        opacity="0.9"
      />
      <path
        d="M8 24C9 20 11 17 14 15L10 19L8 24Z"
        fill={`url(#${id})`}
        opacity="0.6"
      />
      <path
        d="M8 24L6 28"
        stroke={`url(#${id})`}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Spine */}
      <path
        d="M26 4L8 24"
        stroke={`url(#${id})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}
