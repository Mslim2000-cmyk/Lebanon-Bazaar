import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Gem, Home, Palette, Sparkles } from "lucide-react";
import type { Category } from "@shared/schema";

interface CategoryCardProps {
  category: Category;
  productCount?: number;
}

const categoryIcons: Record<string, React.ReactNode> = {
  jewelry: <Gem className="h-8 w-8" />,
  "home-decor": <Home className="h-8 w-8" />,
  art: <Palette className="h-8 w-8" />,
  crafts: <Sparkles className="h-8 w-8" />,
};

export function CategoryCard({ category, productCount }: CategoryCardProps) {
  const icon = categoryIcons[category.slug] || <Sparkles className="h-8 w-8" />;

  return (
    <Link href={`/products?category=${category.slug}`}>
      <Card className="group hover-elevate" data-testid={`card-category-${category.id}`}>
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <div className="mb-4 rounded-full bg-primary/10 p-4 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            {icon}
          </div>
          <h3 className="font-medium" data-testid={`text-category-name-${category.id}`}>
            {category.name}
          </h3>
          {productCount !== undefined && (
            <p className="mt-1 text-sm text-muted-foreground">
              {productCount} {productCount === 1 ? "product" : "products"}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
