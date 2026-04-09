import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px",
          background: "linear-gradient(135deg, #0E1015 0%, #11111a 50%, #0E1015 100%)",
          color: "#f4f4fa",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 18, height: 18, borderRadius: 999, background: "#ef4444" }} />
          <div style={{ fontSize: 28, fontWeight: 700 }}>Quill AI</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.2 }}>
            Personal AI Agent
            <br />
            + Builder Canvas
          </div>
          <div style={{ fontSize: 26, color: "#c7c7d8" }}>
            Fast. Thinking. Pro. Build and iterate in one flow.
          </div>
        </div>

        <div
          style={{
            fontSize: 20,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.09)",
            color: "#fca5a5",
            width: "fit-content",
          }}
        >
          quill.ai
        </div>
      </div>
    ),
    size,
  );
}
