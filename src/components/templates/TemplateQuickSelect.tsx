"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SparklesIcon,
  ChevronDownIcon,
  XMarkIcon,
  Squares2X2Icon as GridIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Template } from "@/lib/builder/templates";
import { recordAnalyticsEvent } from "@/lib/observability/analytics";

interface TemplateQuickSelectProps {
  onTemplateSelect?: (template: Template) => void;
  variant?: "button" | "inline" | "compact";
}

export function TemplateQuickSelect({ onTemplateSelect, variant = "button" }: TemplateQuickSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [popularTemplates, setPopularTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && popularTemplates.length === 0) {
      loadPopularTemplates();
    }
  }, [isOpen, popularTemplates.length]);

  async function loadPopularTemplates() {
    setLoading(true);
    try {
      const res = await fetch("/api/templates?popular=6");
      if (res.ok) {
        const data = await res.json();
        setPopularTemplates(data);
      }
    } catch (error) {
      console.error("Failed to load popular templates:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleTemplateClick = (template: Template) => {
    // Track analytics
    recordAnalyticsEvent({
      userId: "anonymous",
      eventType: "feature_used",
      properties: {
        feature: "template_quick_select",
        templateId: template.id,
        templateName: template.name,
        variant,
      },
    });

    setIsOpen(false);

    if (onTemplateSelect) {
      onTemplateSelect(template);
    } else {
      // Navigate to agent with template
      const params = new URLSearchParams(searchParams.toString());
      params.set("template", template.id);
      router.push(`/agent?${params.toString()}`);
    }
  };

  const handleOpenMarketplace = () => {
    router.push("/templates");
  };

  // Render a single template item
  const renderTemplateItem = (template: Template) => (
    <div
      key={template.id}
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-quill-surface cursor-pointer transition-colors"
      onClick={() => handleTemplateClick(template)}
    >
      <div className="w-12 h-9 rounded-md overflow-hidden shrink-0 bg-quill-surface-2 relative">
        <Image src={template.thumbnail} alt={template.name} fill sizes="48px" className="object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{template.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Badge variant="outline" className="text-[10px] h-auto px-1 py-0">
            {template.category}
          </Badge>
          <span className="text-[10px] text-quill-muted">{template.sections.length} sections</span>
        </div>
      </div>
      <ArrowRightIcon className="h-4 w-4 text-quill-muted" />
    </div>
  );

  // Compact variant - just a small button
  if (variant === "compact") {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2.5 text-xs">
            <SparklesIcon className="h-3.5 w-3.5" />
            Templates
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2" align="end">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-medium text-quill-muted">Popular Templates</span>
              <Button variant="ghost" size="sm" className="h-auto text-xs px-2 py-1" onClick={handleOpenMarketplace}>
                Browse all
              </Button>
            </div>
            {loading ? (
              <div className="text-xs text-quill-muted py-4 text-center">Loading...</div>
            ) : (
              <div className="space-y-1">{popularTemplates.map(renderTemplateItem)}</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Inline variant - shows templates inline
  if (variant === "inline") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-quill-accent" />
          <span className="text-sm font-medium">Start with a template</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {loading ? (
            <div className="text-xs text-quill-muted">Loading templates...</div>
          ) : (
            popularTemplates.slice(0, 4).map((template) => (
              <Card
                key={template.id}
                className="shrink-0 w-40 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleTemplateClick(template)}
              >
                <div className="aspect-video bg-quill-surface-2 rounded-t-lg overflow-hidden relative">
                  <Image src={template.thumbnail} alt={template.name} fill sizes="160px" className="object-cover" />
                </div>
                <CardContent className="p-2">
                  <p className="text-xs font-medium truncate">{template.name}</p>
                  <Badge variant="outline" className="text-[10px] mt-1">
                    {template.category}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
          <Card
            className="shrink-0 w-40 cursor-pointer hover:shadow-md transition-shadow flex items-center justify-center"
            onClick={handleOpenMarketplace}
          >
            <CardContent className="p-4 text-center">
              <GridIcon className="h-6 w-6 text-quill-muted mx-auto mb-2" />
              <p className="text-xs text-quill-muted">Browse all templates</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Default button variant - dropdown with templates
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <SparklesIcon className="h-4 w-4" />
          Use a Template
          <ChevronDownIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-3" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">Quick Templates</h4>
              <p className="text-xs text-quill-muted mt-0.5">Start with a pre-built template</p>
            </div>
            <Button variant="ghost" size="sm" className="h-auto text-xs" onClick={handleOpenMarketplace}>
              Browse all
              <ArrowRightIcon className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>

          {loading ? (
            <div className="text-sm text-quill-muted py-6 text-center">Loading templates...</div>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">{popularTemplates.map(renderTemplateItem)}</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
