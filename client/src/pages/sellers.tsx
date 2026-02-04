import { MainLayout } from "@/components/layout/main-layout";
import { SellerCard } from "@/components/seller-card";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { useState, useMemo } from "react";
import type { Seller } from "@shared/schema";

export default function Sellers() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: sellers, isLoading } = useQuery<Seller[]>({
    queryKey: ["/api/sellers"],
  });

  const filteredSellers = useMemo(() => {
    if (!sellers) return [];
    if (!searchQuery) return sellers;

    const query = searchQuery.toLowerCase();
    return sellers.filter(
      (s) =>
        s.businessName.toLowerCase().includes(query) ||
        s.location.toLowerCase().includes(query) ||
        s.bio?.toLowerCase().includes(query)
    );
  }, [sellers, searchQuery]);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-serif text-2xl font-bold md:text-3xl">Our Artisans</h1>
          <p className="mt-2 text-muted-foreground">
            Meet the talented creators behind every handmade piece
          </p>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search artisans..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-sellers"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array(6).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-12 w-full mt-3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredSellers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-2">No artisans found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? "Try adjusting your search" : "No artisans have joined yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSellers.map((seller) => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
