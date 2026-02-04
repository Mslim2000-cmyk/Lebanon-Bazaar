import { useParams, Link } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Package, ArrowLeft, Phone } from "lucide-react";
import type { Seller, Product, Category } from "@shared/schema";

type ProductWithCategory = Product & { category: Category };

export default function SellerDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: seller, isLoading: loadingSeller, error } = useQuery<Seller>({
    queryKey: ["/api/sellers", id],
    enabled: !!id,
  });

  const { data: products, isLoading: loadingProducts } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/sellers", id, "products"],
    enabled: !!id,
  });

  if (loadingSeller) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-48 w-full rounded-lg mb-6" />
          <div className="flex items-start gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error || !seller) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="font-serif text-2xl font-bold mb-4">Artisan Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The artisan you're looking for doesn't exist.
          </p>
          <Link href="/sellers">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Artisans
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const initials = seller.businessName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <MainLayout>
      {/* Cover Image */}
      <div className="h-48 md:h-64 bg-gradient-to-br from-primary/20 via-accent/30 to-secondary relative">
        {seller.coverImage && (
          <img
            src={seller.coverImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>

      <div className="container mx-auto px-4">
        {/* Seller Info */}
        <div className="-mt-12 relative z-10 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <Avatar className="h-24 w-24 border-4 border-background -mt-16 md:-mt-20">
                  <AvatarImage src={seller.profileImage || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h1 className="font-serif text-2xl font-bold md:text-3xl" data-testid="text-seller-name">
                    {seller.businessName}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{seller.location}</span>
                    </div>
                    {products && (
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        <span>{products.length} products</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {seller.bio && (
                <p className="mt-4 text-muted-foreground" data-testid="text-seller-bio">
                  {seller.bio}
                </p>
              )}

              {seller.deliveryAreas && seller.deliveryAreas.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Delivers to:</h3>
                  <div className="flex flex-wrap gap-2">
                    {seller.deliveryAreas.map((area) => (
                      <Badge key={area} variant="outline">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Products */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-bold mb-4">
            Products by {seller.businessName}
          </h2>
          {loadingProducts ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array(4).fill(0).map((_, i) => (
                <Card key={i}>
                  <Skeleton className="aspect-square" />
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-5 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : products?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No products available yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products?.map((product) => (
                <ProductCard key={product.id} product={{ ...product, seller }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
