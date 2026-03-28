import { google } from "@ai-sdk/google";
import { experimental_generateImage as generateImage } from "ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { prompt } = await req.json();

  if (!prompt || typeof prompt !== "string") {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  try {
    const { image } = await generateImage({
      model: google.image("imagen-4.0-fast-generate-001"),
      prompt,
      aspectRatio: "1:1",
    });

    return Response.json({
      url: `data:${image.mediaType};base64,${image.base64}`,
      mediaType: image.mediaType,
    });
  } catch (error) {
    console.error("Image generation error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate image";
    return Response.json({ error: message }, { status: 500 });
  }
}
