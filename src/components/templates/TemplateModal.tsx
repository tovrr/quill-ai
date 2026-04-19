import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  SparklesIcon,
  SwatchIcon as PaletteIcon,
  DocumentTextIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Template, TemplateCategory, getTemplateById, generateBuilderPrompt } from "@/lib/builder/templates";
import { recordAnalyticsEvent } from "@/lib/observability/analytics";

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template?: Template;
  templateId?: string;
  onSelect?: (template: Template, customizations?: TemplateCustomizations) => void;
}

export interface TemplateCustomizations {
  brandName: string;
  productName: string;
  primaryColor: string;
  industry: string;
  additionalNotes: string;
}

const DEFAULT_CUSTOMIZATIONS: TemplateCustomizations = {
  brandName: "",
  productName: "",
  primaryColor: "",
  industry: "",
  additionalNotes: "",
};

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "Education",
  "E-commerce",
  "Real Estate",
  "Marketing",
  "Media & Entertainment",
  "Non-profit",
  "Professional Services",
  "Manufacturing",
  "Other",
];

export function TemplateModal({
  isOpen,
  onClose,
  template: initialTemplate,
  templateId,
  onSelect,
}: TemplateModalProps) {
  const router = useRouter();

  // State
  const [template, setTemplate] = useState<Template | undefined>(initialTemplate);
  const [loading, setLoading] = useState(false);
  const [customizations, setCustomizations] = useState<TemplateCustomizations>(DEFAULT_CUSTOMIZATIONS);
  const [activeTab, setActiveTab] = useState("preview");
  const [generating, setGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);

  // Fetch template if only ID is provided
  useEffect(() => {
    if (isOpen && templateId && !initialTemplate) {
      setLoading(true);
      fetch(`/api/templates?id=${templateId}`)
        .then((res) => res.json())
        .then((data) => setTemplate(data))
        .catch((err) => console.error("Failed to fetch template:", err))
        .finally(() => setLoading(false));
    } else if (isOpen && initialTemplate) {
      setTemplate(initialTemplate);
    }
  }, [isOpen, templateId, initialTemplate]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setGeneratedPrompt(null);
      setGenerating(false);
      setCustomizations(DEFAULT_CUSTOMIZATIONS);
      setActiveTab("preview");
    }
  }, [isOpen]);

  // Event handlers
  const handleCustomizationChange = (field: keyof TemplateCustomizations, value: string) => {
    setCustomizations((prev) => ({ ...prev, [field]: value }));
  };

  const handleGeneratePrompt = async () => {
    if (!template) return;

    setGenerating(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          customizations: {
            productName: customizations.productName || undefined,
            brandName: customizations.brandName || undefined,
            primaryColor: customizations.primaryColor || undefined,
            industry: customizations.industry || undefined,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedPrompt(data.generatedPrompt);
      } else {
        // Fallback to client-side generation
        const prompt = generateBuilderPrompt(template, customizations);
        setGeneratedPrompt(prompt);
      }
    } catch (error) {
      console.error("Failed to generate prompt:", error);
      // Fallback to client-side generation
      const prompt = generateBuilderPrompt(template, customizations);
      setGeneratedPrompt(prompt);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectTemplate = () => {
    if (!template) return;

    // Track analytics
    recordAnalyticsEvent({
      userId: "anonymous",
      eventType: "feature_used",
      properties: {
        feature: "template_selected",
        templateId: template.id,
        templateName: template.name,
        category: template.category,
        customized: Object.values(customizations).some((v) => v.trim() !== ""),
      },
    });

    if (onSelect) {
      onSelect(template, customizations);
    } else {
      // Navigate to builder with template and customizations
      const params = new URLSearchParams({
        template: template.id,
        ...(customizations.brandName && { brandName: customizations.brandName }),
        ...(customizations.productName && { productName: customizations.productName }),
        ...(customizations.primaryColor && { primaryColor: customizations.primaryColor }),
        ...(customizations.industry && { industry: customizations.industry }),
      });

      if (customizations.additionalNotes) {
        params.set("notes", customizations.additionalNotes);
      }

      router.push(`/agent?${params.toString()}`);
    }

    onClose();
  };

  const handleCopyPrompt = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt);
    }
  };

  // Render color swatch
  const renderColorSwatch = (color: string, label: string) => (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full border border-quill-border shadow-sm" style={{ backgroundColor: color }} />
      <span className="text-xs text-quill-muted">
        {label}: {color}
      </span>
    </div>
  );

  // Render section preview
  const renderSectionPreview = (section: Template["sections"][0]) => (
    <div
      key={section.id}
      className="p-3 border border-quill-border rounded-lg bg-quill-surface hover:bg-quill-surface-2 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="text-xs">
          {section.type}
        </Badge>
        <span className="text-xs font-medium">{section.title}</span>
      </div>
      <p className="text-xs text-quill-muted line-clamp-2">{section.description}</p>
    </div>
  );

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">{template?.name || "Template Preview"}</DialogTitle>
              <DialogDescription className="mt-1">{template?.description}</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <XMarkIcon className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-quill-muted">Loading template...</div>
          </div>
        ) : !template ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-quill-muted">Template not found</div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="customize">Customize</TabsTrigger>
                <TabsTrigger value="sections">Sections</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto">
                {/* Preview Tab */}
                <TabsContent value="preview" className="space-y-4 mt-0">
                  {/* Thumbnail */}
                  <div className="aspect-video bg-linear-to-br from-quill-surface to-quill-surface-2 rounded-xl overflow-hidden border border-quill-border relative">
                    <Image
                      src={template.thumbnail}
                      alt={template.name}
                      fill
                      sizes="(max-width: 1200px) 100vw, 960px"
                      className="object-cover"
                    />
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="gap-1">
                        <TagIcon className="h-3 w-3" />
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* Color Palette */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <PaletteIcon className="h-4 w-4" />
                        Color Palette
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {renderColorSwatch(template.colorPalette.primary, "Primary")}
                      {renderColorSwatch(template.colorPalette.secondary, "Secondary")}
                      {renderColorSwatch(template.colorPalette.accent, "Accent")}
                      {renderColorSwatch(template.colorPalette.background, "Background")}
                      {renderColorSwatch(template.colorPalette.text, "Text")}
                    </CardContent>
                  </Card>

                  {/* Typography */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <DocumentTextIcon className="h-4 w-4" />
                        Typography
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-quill-muted">Heading:</span>
                        <span className="text-sm font-medium">{template.typography.heading}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-quill-muted">Body:</span>
                        <span className="text-sm font-medium">{template.typography.body}</span>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Customize Tab */}
                <TabsContent value="customize" className="space-y-4 mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Brand Name</label>
                      <Input
                        value={customizations.brandName}
                        onChange={(e) => handleCustomizationChange("brandName", e.target.value)}
                        placeholder="e.g., Acme Inc."
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Product Name</label>
                      <Input
                        value={customizations.productName}
                        onChange={(e) => handleCustomizationChange("productName", e.target.value)}
                        placeholder="e.g., SuperApp"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Primary Color</label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={customizations.primaryColor || template.colorPalette.primary}
                          onChange={(e) => handleCustomizationChange("primaryColor", e.target.value)}
                          className="w-12 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={customizations.primaryColor || template.colorPalette.primary}
                          onChange={(e) => handleCustomizationChange("primaryColor", e.target.value)}
                          placeholder="#6366F1"
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Industry</label>
                      <select
                        value={customizations.industry}
                        onChange={(e) => handleCustomizationChange("industry", e.target.value)}
                        className="w-full rounded-lg border border-quill-border bg-quill-surface px-3 py-2 text-sm"
                      >
                        <option value="">Select industry...</option>
                        {INDUSTRIES.map((ind) => (
                          <option key={ind} value={ind}>
                            {ind}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Additional Notes</label>
                    <Textarea
                      value={customizations.additionalNotes}
                      onChange={(e) => handleCustomizationChange("additionalNotes", e.target.value)}
                      placeholder="Any specific requirements or preferences..."
                      rows={4}
                      className="w-full"
                    />
                  </div>

                  {/* Generate Prompt Button */}
                  <div className="flex justify-end">
                    <Button onClick={handleGeneratePrompt} disabled={generating} className="gap-2">
                      <SparklesIcon className="h-4 w-4" />
                      {generating ? "Generating..." : "Generate Prompt"}
                    </Button>
                  </div>

                  {/* Generated Prompt */}
                  {generatedPrompt && (
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold">Generated Prompt</CardTitle>
                          <Button variant="ghost" size="sm" onClick={handleCopyPrompt} className="text-xs">
                            Copy
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs text-quill-muted whitespace-pre-wrap bg-quill-bg p-3 rounded-lg max-h-48 overflow-y-auto">
                          {generatedPrompt}
                        </pre>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Sections Tab */}
                <TabsContent value="sections" className="space-y-4 mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {template.sections.map(renderSectionPreview)}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSelectTemplate} disabled={!template || generating} className="gap-2">
            <CheckIcon className="h-4 w-4" />
            Select Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
