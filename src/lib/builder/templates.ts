/**
 * Template Marketplace - Pre-built Templates
 *
 * Provides ready-to-use templates for common use cases:
 * - Landing pages (SaaS, product launch, portfolio)
 * - Dashboards (analytics, admin, metrics)
 * - Marketing pages (features, pricing, about)
 * - Documentation sites
 * - E-commerce pages
 *
 * Each template includes:
 * - Pre-defined structure and sections
 * - Color palette and typography
 * - Sample content and placeholder text
 * - Responsive design patterns
 */

export type TemplateCategory =
  | "landing"
  | "dashboard"
  | "marketing"
  | "documentation"
  | "ecommerce"
  | "portfolio"
  | "blog"
  | "saas";

export type TemplateSection = {
  id: string;
  type: "hero" | "features" | "pricing" | "testimonials" | "cta" | "footer" | "nav" | "content" | "stats" | "team" | "faq";
  title: string;
  description: string;
  prompt: string;
};

export type Template = {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  thumbnail: string;
  tags: string[];
  sections: TemplateSection[];
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    heading: string;
    body: string;
  };
  prompt: string;
  createdAt: string;
  popularity: number;
};

// ─── Template Definitions ─────────────────────────────────────────────────────

export const templates: Template[] = [
  {
    id: "saas-landing",
    name: "SaaS Product Launch",
    description: "Modern landing page for SaaS product launches with feature highlights, pricing, and CTA sections.",
    category: "landing",
    thumbnail: "https://images.unsplash.com/photo-1460925895917-afdab827c52f",
    tags: ["saas", "product", "startup", "modern"],
    sections: [
      {
        id: "hero",
        type: "hero",
        title: "Hero Section",
        description: "Main headline with value proposition and primary CTA",
        prompt: "Create a compelling hero section with a strong headline, subheadline, and primary CTA button. Include a hero image or illustration on the right side.",
      },
      {
        id: "features",
        type: "features",
        title: "Features Grid",
        description: "3-4 column grid showcasing key product features",
        prompt: "Create a features section with a 3-column grid. Each feature should have an icon, title, and brief description. Focus on benefits, not just features.",
      },
      {
        id: "stats",
        type: "stats",
        title: "Statistics",
        description: "Key metrics and social proof numbers",
        prompt: "Create a statistics section showing impressive numbers like users, uptime, or performance metrics. Use large, bold numbers with labels.",
      },
      {
        id: "pricing",
        type: "pricing",
        title: "Pricing Plans",
        description: "Tiered pricing with feature comparison",
        prompt: "Create a pricing section with 3 tiers. Highlight the middle tier as 'Most Popular'. Include feature lists and CTA buttons for each tier.",
      },
      {
        id: "testimonials",
        type: "testimonials",
        title: "Customer Testimonials",
        description: "Social proof from satisfied customers",
        prompt: "Create a testimonials section with 2-3 customer quotes. Include customer names, photos, and company logos if available.",
      },
      {
        id: "cta",
        type: "cta",
        title: "Final CTA",
        description: "Strong call-to-action before footer",
        prompt: "Create a final CTA section with a compelling message and prominent button. Use contrasting background color to make it stand out.",
      },
      {
        id: "footer",
        type: "footer",
        title: "Footer",
        description: "Site navigation and legal links",
        prompt: "Create a footer with company info, navigation links, social media icons, and legal links (privacy, terms).",
      },
    ],
    colorPalette: {
      primary: "#6366F1",
      secondary: "#8B5CF6",
      accent: "#EC4899",
      background: "#FFFFFF",
      text: "#1F2937",
    },
    typography: {
      heading: "Inter",
      body: "Inter",
    },
    prompt: "Create a modern SaaS landing page with a clean, professional design. Use a purple/indigo color scheme. Focus on clarity, trust, and conversion. Include smooth animations and responsive design.",
    createdAt: "2026-01-15",
    popularity: 95,
  },
  {
    id: "analytics-dashboard",
    name: "Analytics Dashboard",
    description: "Comprehensive analytics dashboard with charts, metrics, and data visualization.",
    category: "dashboard",
    thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71",
    tags: ["analytics", "dashboard", "data", "charts"],
    sections: [
      {
        id: "nav",
        type: "nav",
        title: "Navigation Sidebar",
        description: "Left sidebar with navigation and user profile",
        prompt: "Create a left sidebar navigation with icons and labels. Include user profile at bottom and main navigation items.",
      },
      {
        id: "stats",
        type: "stats",
        title: "Key Metrics",
        description: "Top row of KPI cards with trends",
        prompt: "Create a row of 4 metric cards showing key KPIs. Each card should have a value, label, trend indicator (up/down arrow), and sparkline chart.",
      },
      {
        id: "content",
        type: "content",
        title: "Main Chart Area",
        description: "Large chart showing trends over time",
        prompt: "Create a large chart area showing data trends. Include time range selector and chart type toggle (line/bar). Use a clean, minimal design.",
      },
      {
        id: "features",
        type: "features",
        title: "Data Tables",
        description: "Detailed data tables with sorting and filtering",
        prompt: "Create data tables with sortable columns, filtering options, and pagination. Include row actions and status indicators.",
      },
    ],
    colorPalette: {
      primary: "#3B82F6",
      secondary: "#10B981",
      accent: "#F59E0B",
      background: "#F3F4F6",
      text: "#111827",
    },
    typography: {
      heading: "Inter",
      body: "Inter",
    },
    prompt: "Create a professional analytics dashboard with a clean, data-focused design. Use a blue/green color scheme. Prioritize readability and data clarity. Include interactive elements and responsive layouts.",
    createdAt: "2026-01-10",
    popularity: 88,
  },
  {
    id: "portfolio-minimal",
    name: "Minimal Portfolio",
    description: "Clean, minimal portfolio site for designers and developers.",
    category: "portfolio",
    thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8",
    tags: ["portfolio", "minimal", "creative", "personal"],
    sections: [
      {
        id: "hero",
        type: "hero",
        title: "Hero Introduction",
        description: "Simple hero with name and role",
        prompt: "Create a minimal hero section with large typography showing name and role. Include a brief tagline and social links.",
      },
      {
        id: "content",
        type: "content",
        title: "Work Gallery",
        description: "Grid of project thumbnails",
        prompt: "Create a gallery grid showcasing projects. Each project should have a thumbnail, title, and brief description. Use hover effects for interactivity.",
      },
      {
        id: "content",
        type: "content",
        title: "About Section",
        description: "Personal bio and skills",
        prompt: "Create an about section with a photo, bio text, and skills list. Keep it concise and personable.",
      },
      {
        id: "cta",
        type: "cta",
        title: "Contact CTA",
        description: "Simple contact invitation",
        prompt: "Create a minimal contact section with email link and social media icons. Keep it simple and elegant.",
      },
      {
        id: "footer",
        type: "footer",
        title: "Footer",
        description: "Simple copyright and links",
        prompt: "Create a minimal footer with copyright text and maybe a 'Back to top' link.",
      },
    ],
    colorPalette: {
      primary: "#111827",
      secondary: "#6B7280",
      accent: "#3B82F6",
      background: "#FFFFFF",
      text: "#111827",
    },
    typography: {
      heading: "Playfair Display",
      body: "Inter",
    },
    prompt: "Create a minimal, elegant portfolio site with lots of white space. Use black and white as primary colors with subtle accent. Focus on typography and imagery. Keep animations subtle and refined.",
    createdAt: "2026-01-08",
    popularity: 82,
  },
  {
    id: "ecommerce-product",
    name: "E-commerce Product Page",
    description: "Conversion-optimized product page with gallery, details, and checkout.",
    category: "ecommerce",
    thumbnail: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
    tags: ["ecommerce", "product", "shopping", "conversion"],
    sections: [
      {
        id: "nav",
        type: "nav",
        title: "Header Navigation",
        description: "Top nav with logo, search, and cart",
        prompt: "Create a header with logo, search bar, navigation links, and cart icon with item count.",
      },
      {
        id: "content",
        type: "content",
        title: "Product Gallery",
        description: "Image gallery with thumbnails",
        prompt: "Create a product image gallery with main image and thumbnail strip. Include zoom functionality and multiple angle views.",
      },
      {
        id: "content",
        type: "content",
        title: "Product Details",
        description: "Title, price, description, and options",
        prompt: "Create a product details section with title, price, description, size/color selectors, quantity, and add to cart button.",
      },
      {
        id: "features",
        type: "features",
        title: "Product Features",
        description: "Key features and specifications",
        prompt: "Create a features section with icons and text highlighting product benefits, materials, and specifications.",
      },
      {
        id: "testimonials",
        type: "testimonials",
        title: "Reviews",
        description: "Customer reviews and ratings",
        prompt: "Create a reviews section with star rating summary, individual reviews, and review form.",
      },
    ],
    colorPalette: {
      primary: "#1F2937",
      secondary: "#6B7280",
      accent: "#EF4444",
      background: "#FFFFFF",
      text: "#1F2937",
    },
    typography: {
      heading: "Inter",
      body: "Inter",
    },
    prompt: "Create a clean, conversion-focused e-commerce product page. Use a neutral color scheme with clear CTAs. Prioritize product imagery and make the purchase flow obvious.",
    createdAt: "2026-01-05",
    popularity: 90,
  },
  {
    id: "documentation-site",
    name: "Documentation Site",
    description: "Technical documentation site with search, navigation, and code examples.",
    category: "documentation",
    thumbnail: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe",
    tags: ["documentation", "docs", "api", "technical"],
    sections: [
      {
        id: "nav",
        type: "nav",
        title: "Docs Navigation",
        description: "Left sidebar with doc tree",
        prompt: "Create a left sidebar with collapsible navigation tree for documentation sections. Include search at top.",
      },
      {
        id: "content",
        type: "content",
        title: "Main Content",
        description: "Documentation content area",
        prompt: "Create a main content area with headings, paragraphs, code blocks, and inline code. Use clear typography and good readability.",
      },
      {
        id: "features",
        type: "features",
        title: "Code Examples",
        description: "Syntax-highlighted code blocks",
        prompt: "Create code example blocks with syntax highlighting, copy button, and language selector. Include both light and dark theme support.",
      },
      {
        id: "content",
        type: "content",
        title: "Table of Contents",
        description: "Right sidebar with page TOC",
        prompt: "Create a right sidebar with table of contents for the current page. Highlight current section and allow quick navigation.",
      },
    ],
    colorPalette: {
      primary: "#0EA5E9",
      secondary: "#64748B",
      accent: "#8B5CF6",
      background: "#FFFFFF",
      text: "#0F172A",
    },
    typography: {
      heading: "Inter",
      body: "Inter",
    },
    prompt: "Create a clean, readable documentation site. Use a blue color scheme. Prioritize readability with good contrast, clear typography, and well-organized content structure.",
    createdAt: "2026-01-03",
    popularity: 75,
  },
];

// ─── Template Functions ───────────────────────────────────────────────────────

/**
 * Get all templates, optionally filtered by category
 */
export function getTemplates(category?: TemplateCategory): Template[] {
  if (!category) return templates;
  return templates.filter((t) => t.category === category);
}

/**
 * Get a single template by ID
 */
export function getTemplateById(id: string): Template | undefined {
  return templates.find((t) => t.id === id);
}

/**
 * Search templates by keyword
 */
export function searchTemplates(query: string): Template[] {
  const lowerQuery = query.toLowerCase();
  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get templates sorted by popularity
 */
export function getPopularTemplates(limit = 10): Template[] {
  return [...templates].sort((a, b) => b.popularity - a.popularity).slice(0, limit);
}

/**
 * Get template categories with counts
 */
export function getTemplateCategories(): { category: TemplateCategory; count: number; label: string }[] {
  const categoryLabels: Record<TemplateCategory, string> = {
    landing: "Landing Pages",
    dashboard: "Dashboards",
    marketing: "Marketing",
    documentation: "Documentation",
    ecommerce: "E-commerce",
    portfolio: "Portfolio",
    blog: "Blog",
    saas: "SaaS",
  };

  const counts = new Map<TemplateCategory, number>();
  templates.forEach((t) => {
    counts.set(t.category, (counts.get(t.category) || 0) + 1);
  });

  return Array.from(counts.entries()).map(([category, count]) => ({
    category,
    count,
    label: categoryLabels[category],
  }));
}

/**
 * Generate a builder prompt from a template
 */
export function generateBuilderPrompt(template: Template, customizations?: {
  productName?: string;
  brandName?: string;
  primaryColor?: string;
  industry?: string;
}): string {
  const { productName, brandName, primaryColor, industry } = customizations || {};

  let prompt = template.prompt;

  if (productName) {
    prompt += ` The product name is "${productName}".`;
  }
  if (brandName) {
    prompt += ` The brand name is "${brandName}".`;
  }
  if (industry) {
    prompt += ` This is for the ${industry} industry.`;
  }
  if (primaryColor) {
    prompt += ` Use ${primaryColor} as the primary color.`;
  }

  prompt += `\n\nUse the following section structure:`;
  template.sections.forEach((section) => {
    prompt += `\n- ${section.title}: ${section.prompt}`;
  });

  return prompt;
}
