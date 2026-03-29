import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quill AI",
    short_name: "Quill",
    description: "Your personal AI agent — research, write, code, and build.",
    start_url: "/agent",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0a0a0f",
    theme_color: "#EF4444",
    categories: ["productivity", "utilities"],
    icons: [],
    shortcuts: [
      {
        name: "New Chat",
        short_name: "New Chat",
        description: "Start a new conversation",
        url: "/agent",
      },
    ],
  };
}
