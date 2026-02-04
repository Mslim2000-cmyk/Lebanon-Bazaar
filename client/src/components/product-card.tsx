import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, MapPin } from "lucide-react";
import type { Product, Seller, Category } from "@shared/schema";

interface ProductCardProps {
  product: Product & { seller?: Seller; category?: Category };
  onAddToCart?: () => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const mainImage = product.images?.[0] || "/placeholder-product.jpg";

  return (
    <Card className="group overflow-visible hover-elevate" data-testid={`card-product-${product.id}`}>
      <Link href={`/products/${product.id}`}>
        <div className="relative aspect-square overflow-hidden rounded-t-md">
          <img
            src={mainImage}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          {product.isFeatured && (
            <Badge className="absolute left-2 top-2" variant="secondary">
              Featured
            </Badge>
          )}
          {!product.isAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Badge variant="secondary">Sold Out</Badge>
            </div>
          )}
        </div>
      </Link>
      <CardContent className="p-4">
        <Link href={`/products/${product.id}`}>
          <h3 className="line-clamp-2 font-medium hover:text-primary" data-testid={`text-product-name-${product.id}`}>
            {product.name}
          </h3>
        </Link>
        
        {product.seller && (
          <Link href={`/sellers/${product.seller.id}`}>
            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{product.seller.businessName}</span>
            </div>
          </Link>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-serif text-lg font-bold text-primary" data-testid={`text-product-price-${product.id}`}>
            ${Number(product.priceUsd).toFixed(2)}
          </span>
          {product.isAvailable && onAddToCart && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                onAddToCart();
              }}
              data-testid={`button-add-cart-${product.id}`}
            >
              <ShoppingBag className="h-4 w-4" />
            </Button>
          )}
        </div>

        {product.category && (
          <Badge variant="outline" className="mt-2">
            {product.category.name}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
