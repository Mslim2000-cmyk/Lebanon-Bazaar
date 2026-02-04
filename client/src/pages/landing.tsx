import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/product-card";
import { CategoryCard } from "@/components/category-card";
import { SellerCard } from "@/components/seller-card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowRight, 
  Gem, 
  Home as HomeIcon, 
  Palette, 
  Sparkles, 
  ShieldCheck, 
  Truck, 
  HandHeart,
  Star
} from "lucide-react";
import type { Product, Seller, Category } from "@shared/schema";

export default function Landing() {
  const { data: featuredProducts, isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/products?featured=true"],
  });

  const { data: categories, isLoading: loadingCategories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: topSellers, isLoading: loadingSellers } = useQuery<Seller[]>({
    queryKey: ["/api/sellers"],
  });

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-accent/30 to-background">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
            <div className="space-y-6">
              <Badge variant="secondary" className="px-4 py-1.5">
                <Sparkles className="mr-2 h-3 w-3" />
                Discover Authentic Lebanese Craftsmanship
              </Badge>
              <h1 className="font-serif text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
                Handmade Treasures from{" "}
                <span className="text-primary">Lebanese Artisans</span>
              </h1>
              <p className="text-lg text-muted-foreground md:text-xl">
                Connect directly with local craftspeople. Find unique jewelry, home decor, 
                art, and handmade crafts that tell a story of tradition and creativity.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/products">
                  <Button size="lg" className="w-full sm:w-auto" data-testid="button-explore-products">
                    Explore Products
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/become-seller">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="button-become-seller">
                    Become a Seller
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <span>Verified Artisans</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  <span>Lebanon-wide Delivery</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <Card className="overflow-hidden">
                    <div className="aspect-square bg-gradient-to-br from-primary/20 to-accent/40 flex items-center justify-center">
                      <Gem className="h-16 w-16 text-primary/60" />
                    </div>
                  </Card>
                  <Card className="overflow-hidden">
                    <div className="aspect-[4/3] bg-gradient-to-br from-accent/40 to-secondary flex items-center justify-center">
                      <Palette className="h-12 w-12 text-primary/60" />
                    </div>
                  </Card>
                </div>
                <div className="space-y-4 pt-8">
                  <Card className="overflow-hidden">
                    <div className="aspect-[4/3] bg-gradient-to-br from-secondary to-primary/20 flex items-center justify-center">
                      <HomeIcon className="h-12 w-12 text-primary/60" />
                    </div>
                  </Card>
                  <Card className="overflow-hidden">
                    <div className="aspect-square bg-gradient-to-br from-accent/40 to-primary/20 flex items-center justify-center">
                      <Sparkles className="h-16 w-16 text-primary/60" />
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-serif text-2xl font-bold md:text-3xl">Shop by Category</h2>
              <p className="mt-2 text-muted-foreground">Find exactly what you're looking for</p>
            </div>
            <Link href="/categories">
              <Button variant="ghost" data-testid="button-view-all-categories">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {loadingCategories ? (
              Array(4).fill(0).map((_, i) => (
                <Card key={i}>
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <Skeleton className="h-16 w-16 rounded-full mb-4" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))
            ) : categories?.slice(0, 4).map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-serif text-2xl font-bold md:text-3xl">Featured Products</h2>
              <p className="mt-2 text-muted-foreground">Handpicked treasures from our artisans</p>
            </div>
            <Link href="/products">
              <Button variant="ghost" data-testid="button-view-all-products">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {loadingProducts ? (
              Array(8).fill(0).map((_, i) => (
                <Card key={i}>
                  <Skeleton className="aspect-square" />
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-3 w-24 mb-3" />
                    <Skeleton className="h-5 w-16" />
                  </CardContent>
                </Card>
              ))
            ) : featuredProducts?.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16 bg-gradient-to-br from-primary/5 to-accent/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-serif text-2xl font-bold md:text-3xl">Why Choose Souq Artisan?</h2>
            <p className="mt-2 text-muted-foreground">Supporting local talent, one purchase at a time</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="text-center">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <HandHeart className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Support Local Artisans</h3>
                <p className="text-sm text-muted-foreground">
                  Every purchase directly supports Lebanese craftspeople and their families
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Star className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Authentic Quality</h3>
                <p className="text-sm text-muted-foreground">
                  Handmade with care and attention to detail by verified artisans
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Truck className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Easy Cash on Delivery</h3>
                <p className="text-sm text-muted-foreground">
                  Pay when you receive your order, delivered anywhere in Lebanon
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Top Artisans Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-serif text-2xl font-bold md:text-3xl">Meet Our Artisans</h2>
              <p className="mt-2 text-muted-foreground">Talented creators behind every piece</p>
            </div>
            <Link href="/sellers">
              <Button variant="ghost" data-testid="button-view-all-artisans">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {loadingSellers ? (
              Array(4).fill(0).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-16 w-16 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : topSellers?.map((seller) => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-serif text-2xl font-bold md:text-3xl mb-4">
            Are You a Lebanese Artisan?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            Join our community of talented creators. Reach customers across Lebanon 
            and share your craft with the world.
          </p>
          <Link href="/become-seller">
            <Button size="lg" variant="secondary" data-testid="button-join-marketplace">
              Join the Marketplace
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </MainLayout>
  );
}
