import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin, Package } from "lucide-react";
import type { Seller } from "@shared/schema";

interface SellerCardProps {
  seller: Seller;
  productCount?: number;
}

export function SellerCard({ seller, productCount }: SellerCardProps) {
  const initials = seller.businessName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link href={`/sellers/${seller.id}`}>
      <Card className="group hover-elevate" data-testid={`card-seller-${seller.id}`}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={seller.profileImage || undefined} alt={seller.businessName} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate group-hover:text-primary" data-testid={`text-seller-name-${seller.id}`}>
                {seller.businessName}
              </h3>
              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{seller.location}</span>
              </div>
              {productCount !== undefined && (
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <Package className="h-3 w-3 flex-shrink-0" />
                  <span>{productCount} products</span>
                </div>
              )}
            </div>
          </div>
          {seller.bio && (
            <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
              {seller.bio}
            </p>
          )}
          {seller.deliveryAreas && seller.deliveryAreas.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {seller.deliveryAreas.slice(0, 3).map((area) => (
                <Badge key={area} variant="outline" className="text-xs">
                  {area}
                </Badge>
              ))}
              {seller.deliveryAreas.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{seller.deliveryAreas.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
