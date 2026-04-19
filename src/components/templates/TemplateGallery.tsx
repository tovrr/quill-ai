import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import {
  MagnifyingGlassIcon as SearchIcon,
  FunnelIcon as FilterIcon,
  Squares2X2Icon as GridIcon,
  ListBulletIcon as ListIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  StarIcon,
  ChartBarIcon as TrendingUpIcon,
  ClockIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Template,
  TemplateCategory,
  getTemplates,
  getTemplateCategories,
  searchTemplates,
  getPopularTemplates,
} from "@/lib/builder/templates";
import { recordAnalyticsEvent } from "@/lib/observability/analytics";

type ViewMode = "grid" | "list";
type SortOption = "popular" | "newest" | "name";

interface TemplateGalleryProps {
  onTemplateSelect?: (template: Template) => void;
  selectedCategory?: TemplateCategory;
  compact?: boolean;
}

export function TemplateGallery({ onTemplateSelect, selectedCategory, compact = false }: TemplateGalleryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortOption, setSortOption] = useState<SortOption>("popular");
  const [selectedCategoryState, setSelectedCategoryState] = useState<TemplateCategory | "all">(
    selectedCategory || (searchParams.get("category") as TemplateCategory) || "all",
  );
  const [showFilters, setShowFilters] = useState(false);

  const sortTemplates = useCallback(
    (templates: Template[]): Template[] => {
      const sorted = [...templates];

      switch (sortOption) {
        case "popular":
          return sorted.sort((a, b) => b.popularity - a.popularity);
        case "newest":
          return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        case "name":
          return sorted.sort((a, b) => a.name.localeCompare(b.name));
        default:
          return sorted;
      }
    },
    [sortOption],
  );

  // Fetch data
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const templatesPromise = (async (): Promise<Template[]> => {
          let data: Template[] = [];

          if (searchQuery.trim()) {
            const res = await fetch(`/api/templates?search=${encodeURIComponent(searchQuery)}`);
            if (res.ok) {
              const result = await res.json();
              data = result.templates || [];
            }
          } else if (selectedCategoryState === "all") {
            const res = await fetch(`/api/templates?popular=10`);
            if (res.ok) {
              data = await res.json();
            }
          } else {
            const res = await fetch(`/api/templates?category=${selectedCategoryState}`);
            if (res.ok) {
              const result = await res.json();
              data = result.templates || [];
            }
          }

          return sortTemplates(data);
        })();

        const categoriesPromise = (async (): Promise<any[]> => {
          const res = await fetch("/api/templates?category=all");
          if (res.ok) return await res.json();
          return [];
        })();

        const [templatesData, categoriesData] = await Promise.all([templatesPromise, categoriesPromise]);
        if (cancelled) return;
        setTemplates(templatesData);
        setCategories(categoriesData);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load templates:", error);
        toast({
          title: "Error",
          description: "Failed to load templates. Please try again.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [searchQuery, selectedCategoryState, sortTemplates, toast]);

  // Event handlers
  const handleTemplateSelect = (template: Template) => {
    // Track analytics
    recordAnalyticsEvent({
      userId: "anonymous", // Will be replaced with actual user ID in production
      eventType: "feature_used",
      properties: {
        feature: "template_selection",
        templateId: template.id,
        templateName: template.name,
        category: template.category,
      },
    });

    if (onTemplateSelect) {
      onTemplateSelect(template);
    } else {
      // Navigate to builder with template
      const params = new URLSearchParams({ template: template.id });
      router.push(`/agent?${params.toString()}`);
    }
  };

  const handleCategoryChange = (category: TemplateCategory | "all") => {
    setSelectedCategoryState(category);
    // Update URL without page refresh
    const newParams = new URLSearchParams(searchParams.toString());
    if (category !== "all") {
      newParams.set("category", category);
    } else {
      newParams.delete("category");
    }
    router.replace(`?${newParams.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is handled by useEffect
  };

  // Render functions
  const renderTemplateCard = (template: Template) => (
    <Card
      key={template.id}
      className="group cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-quill-border-2"
      onClick={() => handleTemplateSelect(template)}
    >
      <div className="aspect-video bg-linear-to-br from-quill-surface to-quill-surface-2 rounded-t-lg overflow-hidden relative">
        <Image
          src={template.thumbnail}
          alt={template.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-200"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute top-3 left-3">
          <Badge variant="secondary" className="bg-black/60 text-white border-none">
            {template.category}
          </Badge>
        </div>
        <div className="absolute bottom-3 right-3 flex gap-1">
          <Badge variant="outline" className="bg-black/40 text-white border-none text-xs">
            <StarIcon className="h-3 w-3 mr-1" />
            {template.popularity}
          </Badge>
        </div>
      </div>

      <CardHeader className="space-y-2">
        <CardTitle className="text-sm font-semibold line-clamp-2">{template.name}</CardTitle>
        <CardDescription className="text-xs line-clamp-2">{template.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between text-xs text-quill-muted">
          <span>{template.sections.length} sections</span>
          <div className="flex gap-1">
            {template.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderTemplateRow = (template: Template) => (
    <div
      key={template.id}
      className="flex items-center gap-4 p-4 border border-quill-border rounded-lg hover:bg-quill-surface transition-colors cursor-pointer"
      onClick={() => handleTemplateSelect(template)}
    >
      <div className="w-20 h-16 bg-linear-to-br from-quill-surface to-quill-surface-2 rounded-lg overflow-hidden shrink-0 relative">
        <Image src={template.thumbnail} alt={template.name} fill sizes="80px" className="object-cover" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-sm">{template.name}</h3>
          <Badge variant="secondary" className="text-xs">
            {template.category}
          </Badge>
          <Badge variant="outline" className="text-xs flex items-center gap-1">
            <StarIcon className="h-3 w-3" />
            {template.popularity}
          </Badge>
        </div>
        <p className="text-xs text-quill-muted line-clamp-2">{template.description}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-quill-muted">{template.sections.length} sections</span>
          <div className="flex gap-1">
            {template.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="text-xs">
          Select
        </Button>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="space-y-4">
        {/* Compact header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Templates</h3>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8 p-0"
            >
              <GridIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 w-8 p-0"
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-quill-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-10"
          />
        </form>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-video bg-quill-surface rounded-t-lg" />
                <CardContent className="space-y-2 p-4">
                  <div className="h-4 bg-quill-surface rounded w-3/4" />
                  <div className="h-3 bg-quill-surface rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(renderTemplateCard)}
          </div>
        ) : (
          <div className="space-y-4">{templates.map(renderTemplateRow)}</div>
        )}

        {templates.length === 0 && !loading && (
          <div className="text-center py-8 text-quill-muted">
            No templates found. Try adjusting your search or filters.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Template Marketplace</h1>
          <p className="text-quill-muted">Choose from our curated collection of templates</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            onClick={() => setViewMode("grid")}
            className="gap-2"
          >
            <GridIcon className="h-4 w-4" />
            Grid
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            onClick={() => setViewMode("list")}
            className="gap-2"
          >
            <ListIcon className="h-4 w-4" />
            List
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FilterIcon className="h-5 w-5 text-quill-muted" />
              <CardTitle>Filters</CardTitle>
            </div>
            <Button variant="ghost" onClick={() => setShowFilters(!showFilters)} className="gap-2">
              {showFilters ? (
                <>
                  <ChevronUpIcon className="h-4 w-4" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDownIcon className="h-4 w-4" />
                  Show
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {showFilters && (
          <CardContent className="space-y-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-quill-muted" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates by name, description, or tags..."
                className="pl-10"
              />
            </form>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategoryState === "all" ? "default" : "outline"}
                  onClick={() => handleCategoryChange("all")}
                  size="sm"
                >
                  All
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category.category}
                    variant={selectedCategoryState === category.category ? "default" : "outline"}
                    onClick={() => handleCategoryChange(category.category)}
                    size="sm"
                  >
                    {category.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium mb-2">Sort by</label>
              <div className="flex gap-2">
                <Button
                  variant={sortOption === "popular" ? "default" : "outline"}
                  onClick={() => setSortOption("popular")}
                  size="sm"
                  className="gap-2"
                >
                  <TrendingUpIcon className="h-4 w-4" />
                  Popular
                </Button>
                <Button
                  variant={sortOption === "newest" ? "default" : "outline"}
                  onClick={() => setSortOption("newest")}
                  size="sm"
                  className="gap-2"
                >
                  <ClockIcon className="h-4 w-4" />
                  Newest
                </Button>
                <Button
                  variant={sortOption === "name" ? "default" : "outline"}
                  onClick={() => setSortOption("name")}
                  size="sm"
                  className="gap-2"
                >
                  <SparklesIcon className="h-4 w-4" />
                  Name
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(9)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-video bg-quill-surface rounded-t-lg" />
              <CardContent className="space-y-2 p-4">
                <div className="h-4 bg-quill-surface rounded w-3/4" />
                <div className="h-3 bg-quill-surface rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{templates.map(renderTemplateCard)}</div>
      ) : (
        <div className="space-y-4">{templates.map(renderTemplateRow)}</div>
      )}

      {templates.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-quill-muted mb-4">
            <SparklesIcon className="h-12 w-12 mx-auto mb-4" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No templates found</h3>
          <p className="text-quill-muted mb-6">
            Try adjusting your search criteria or browse our popular templates below.
          </p>
          <Button
            onClick={() => {
              setSelectedCategoryState("all");
              setSearchQuery("");
              setSortOption("popular");
            }}
          >
            Show Popular Templates
          </Button>
        </div>
      )}
    </div>
  );
}
