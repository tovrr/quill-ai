import { NextRequest } from "next/server";
import { getTemplates, getTemplateById, searchTemplates, getPopularTemplates, getTemplateCategories, generateBuilderPrompt } from "@/lib/builder/templates";

type TemplateQuery = {
  category?: string;
  search?: string;
  popular?: string;
  id?: string;
  customizations?: {
    productName?: string;
    brandName?: string;
    primaryColor?: string;
    industry?: string;
  };
};

function parseTemplateQuery(request: NextRequest): TemplateQuery {
  const searchParams = request.nextUrl.searchParams;
  return {
    category: searchParams.get("category") || undefined,
    search: searchParams.get("search") || undefined,
    popular: searchParams.get("popular") || undefined,
    id: searchParams.get("id") || undefined,
    customizations: searchParams.get("customizations") ? JSON.parse(searchParams.get("customizations")!) : undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const query = parseTemplateQuery(request);

    // Get single template by ID
    if (query.id) {
      const template = getTemplateById(query.id);
      if (!template) {
        return Response.json({ error: "Template not found" }, { status: 404 });
      }

      // Generate custom prompt if customizations provided
      if (query.customizations) {
        const customPrompt = generateBuilderPrompt(template, query.customizations);
        return Response.json({
          ...template,
          customPrompt,
        });
      }

      return Response.json(template);
    }

    // Get popular templates
    if (query.popular) {
      const limit = parseInt(query.popular) || 10;
      const templates = getPopularTemplates(Math.min(limit, 20));
      return Response.json(templates);
    }

    // Search templates
    if (query.search) {
      const templates = searchTemplates(query.search);
      return Response.json({
        query: query.search,
        results: templates.length,
        templates,
      });
    }

    // Get categories
    if (query.category === "all") {
      const categories = getTemplateCategories();
      return Response.json(categories);
    }

    // Get templates (with optional category filter)
    const templates = getTemplates(query.category as any);
    return Response.json({
      category: query.category,
      total: templates.length,
      templates,
    });
  } catch (error) {
    console.error("[templates] Error:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, customizations } = body;

    if (!templateId) {
      return Response.json({ error: "Template ID is required" }, { status: 400 });
    }

    const template = getTemplateById(templateId);
    if (!template) {
      return Response.json({ error: "Template not found" }, { status: 404 });
    }

    const prompt = generateBuilderPrompt(template, customizations);

    return Response.json({
      template,
      generatedPrompt: prompt,
    });
  } catch (error) {
    console.error("[templates] Error:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Failed to generate template prompt" }, { status: 500 });
  }
}
