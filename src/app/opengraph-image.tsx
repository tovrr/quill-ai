import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          background: "radial-gradient(circle at 20% 20%, #3b1114 0%, #0E1015 45%, #06060b 100%)",
          color: "#f4f4fa",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              background: "#ef4444",
              boxShadow: "0 0 28px rgba(239,68,68,0.55)",
            }}
          />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.3 }}>Quill AI</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.4 }}>
            Your AI Agent
            <br />
            That Gets Things Done
          </div>
          <div style={{ fontSize: 28, color: "#c7c7d8", maxWidth: 980 }}>
            Research, write, code, and build app artifacts with live preview.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {[
            "Agent Chat",
            "Page/React/Next.js Builder",
            "Live Canvas Preview",
          ].map((label) => (
            <div
              key={label}
              style={{
                fontSize: 21,
                padding: "10px 16px",
                borderRadius: 999,
                border: "1px solid rgba(239,68,68,0.35)",
                background: "rgba(239,68,68,0.09)",
                color: "#fca5a5",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
