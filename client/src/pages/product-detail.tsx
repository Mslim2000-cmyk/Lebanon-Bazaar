import { useParams, Link } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingBag, 
  MapPin, 
  Phone, 
  Truck,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check
} from "lucide-react";
import { useState } from "react";
import type { Product, Seller, Category } from "@shared/schema";

type ProductWithRelations = Product & { seller: Seller; category: Category };

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const { data: product, isLoading, error } = useQuery<ProductWithRelations>({
    queryKey: ["/api/products", id],
    enabled: !!id,
  });

  const handleAddToCart = () => {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const existingItem = cart.find((item: any) => item.productId === product?.id);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        productId: product?.id,
        sellerId: product?.sellerId,
        name: product?.name,
        price: product?.priceUsd,
        image: product?.images?.[0],
        quantity: 1,
      });
    }
    
    localStorage.setItem("cart", JSON.stringify(cart));
    toast({
      title: "Added to cart",
      description: `${product?.name} has been added to your cart.`,
    });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <Skeleton className="aspect-square rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error || !product) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="font-serif text-2xl font-bold mb-4">Product Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The product you're looking for doesn't exist or has been removed.
          </p>
          <Link href="/products">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Products
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const images = product.images || [];
  const currentImage = images[selectedImageIndex] || "/placeholder-product.jpg";

  const sellerInitials = product.seller?.businessName
    ?.split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/products">
            <span className="hover:text-foreground">Products</span>
          </Link>
          <span>/</span>
          {product.category && (
            <>
              <Link href={`/products?category=${product.category.slug}`}>
                <span className="hover:text-foreground">{product.category.name}</span>
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-foreground truncate max-w-48">{product.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
              <img
                src={currentImage}
                alt={product.name}
                className="h-full w-full object-cover"
                data-testid="img-product-main"
              />
              {!product.isAvailable && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    Sold Out
                  </Badge>
                </div>
              )}
              {images.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2"
                    onClick={() => setSelectedImageIndex((i) => (i === 0 ? images.length - 1 : i - 1))}
                    data-testid="button-prev-image"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setSelectedImageIndex((i) => (i === images.length - 1 ? 0 : i + 1))}
                    data-testid="button-next-image"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 h-20 w-20 rounded-md overflow-hidden border-2 transition-colors ${
                      index === selectedImageIndex ? "border-primary" : "border-transparent"
                    }`}
                    data-testid={`button-thumbnail-${index}`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              {product.category && (
                <Badge variant="outline" className="mb-2">
                  {product.category.name}
                </Badge>
              )}
              <h1 className="font-serif text-2xl font-bold md:text-3xl" data-testid="text-product-name">
                {product.name}
              </h1>
              <p className="mt-4 font-serif text-3xl font-bold text-primary" data-testid="text-product-price">
                ${Number(product.priceUsd).toFixed(2)}
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-line" data-testid="text-product-description">
                {product.description}
              </p>
            </div>

            <Separator />

            {/* Seller Info */}
            {product.seller && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={product.seller.profileImage || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {sellerInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <Link href={`/sellers/${product.seller.id}`}>
                        <h4 className="font-medium hover:text-primary" data-testid="link-seller">
                          {product.seller.businessName}
                        </h4>
                      </Link>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{product.seller.location}</span>
                      </div>
                    </div>
                    <Link href={`/sellers/${product.seller.id}`}>
                      <Button variant="outline" size="sm">
                        View Shop
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Delivery Info */}
            <Card className="bg-accent/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Truck className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">Cash on Delivery</h4>
                    <p className="text-sm text-muted-foreground">
                      Pay when you receive your order. Delivery across Lebanon.
                    </p>
                    {product.seller?.deliveryAreas && product.seller.deliveryAreas.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="text-sm text-muted-foreground">Delivers to:</span>
                        {product.seller.deliveryAreas.map((area) => (
                          <Badge key={area} variant="outline" className="text-xs">
                            {area}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Add to Cart */}
            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1"
                disabled={!product.isAvailable}
                onClick={handleAddToCart}
                data-testid="button-add-to-cart"
              >
                <ShoppingBag className="mr-2 h-5 w-5" />
                {product.isAvailable ? "Add to Cart" : "Sold Out"}
              </Button>
            </div>

            {/* Features */}
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Handmade with care by a local artisan</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Unique, one-of-a-kind piece</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Support local Lebanese talent</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
