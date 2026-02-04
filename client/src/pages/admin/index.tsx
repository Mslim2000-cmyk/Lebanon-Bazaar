import { useEffect } from "react";
import { useLocation } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  Package, 
  ShoppingCart, 
  DollarSign, 
  Loader2,
  Check,
  X,
  MapPin
} from "lucide-react";
import type { Seller, Product, Order } from "@shared/schema";

export default function AdminDashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: sellers, isLoading: sellersLoading } = useQuery<Seller[]>({
    queryKey: ["/api/admin/sellers"],
    enabled: isAuthenticated,
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: isAuthenticated,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/admin/orders"],
    enabled: isAuthenticated,
  });

  const updateSellerStatusMutation = useMutation({
    mutationFn: async ({ sellerId, status }: { sellerId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/admin/sellers/${sellerId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sellers"] });
      toast({ title: "Seller status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update seller", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/api/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </MainLayout>
    );
  }

  const pendingSellers = sellers?.filter((s) => s.status === "pending") || [];
  const approvedSellers = sellers?.filter((s) => s.status === "approved") || [];
  const totalRevenue = orders
    ?.filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + Number(o.totalUsd), 0) || 0;
  const totalCommission = orders
    ?.filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + Number(o.commissionUsd), 0) || 0;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
      suspended: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getOrderStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      confirmed: "default",
      shipped: "default",
      delivered: "default",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-serif text-2xl font-bold md:text-3xl">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage sellers, products, and orders</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sellers</p>
                  <p className="text-2xl font-bold">{approvedSellers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-amber-500/10">
                  <Users className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Approval</p>
                  <p className="text-2xl font-bold">{pendingSellers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Products</p>
                  <p className="text-2xl font-bold">{products?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Commission</p>
                  <p className="text-2xl font-bold">${totalCommission.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending Sellers
              {pendingSellers.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingSellers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sellers" data-testid="tab-sellers">All Sellers</TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders">All Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {sellersLoading ? (
              <div className="space-y-4">
                {Array(2).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-16 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : pendingSellers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No pending seller applications</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingSellers.map((seller) => (
                  <Card key={seller.id} data-testid={`card-pending-seller-${seller.id}`}>
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={seller.profileImage || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {seller.businessName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="font-medium">{seller.businessName}</h3>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{seller.location}</span>
                          </div>
                          {seller.bio && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {seller.bio}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground mt-1">
                            Phone: {seller.phone}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => updateSellerStatusMutation.mutate({ 
                              sellerId: seller.id, 
                              status: "approved" 
                            })}
                            disabled={updateSellerStatusMutation.isPending}
                            data-testid={`button-approve-${seller.id}`}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => updateSellerStatusMutation.mutate({ 
                              sellerId: seller.id, 
                              status: "rejected" 
                            })}
                            disabled={updateSellerStatusMutation.isPending}
                            data-testid={`button-reject-${seller.id}`}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sellers" className="mt-6">
            {sellersLoading ? (
              <div className="space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-12 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : sellers?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No sellers yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {sellers?.map((seller) => (
                  <Card key={seller.id} data-testid={`card-seller-${seller.id}`}>
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={seller.profileImage || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {seller.businessName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{seller.businessName}</h3>
                            {getStatusBadge(seller.status)}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{seller.location}</span>
                            <span className="mx-2">•</span>
                            <span>{seller.phone}</span>
                          </div>
                        </div>
                        {seller.status === "approved" && (
                          <Button
                            variant="outline"
                            onClick={() => updateSellerStatusMutation.mutate({ 
                              sellerId: seller.id, 
                              status: "suspended" 
                            })}
                            disabled={updateSellerStatusMutation.isPending}
                          >
                            Suspend
                          </Button>
                        )}
                        {seller.status === "suspended" && (
                          <Button
                            onClick={() => updateSellerStatusMutation.mutate({ 
                              sellerId: seller.id, 
                              status: "approved" 
                            })}
                            disabled={updateSellerStatusMutation.isPending}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            {ordersLoading ? (
              <div className="space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-12 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : orders?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No orders yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders?.map((order) => (
                  <Card key={order.id} data-testid={`card-order-${order.id}`}>
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">#{order.orderNumber}</h3>
                            {getOrderStatusBadge(order.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {order.buyerName} • {order.buyerPhone}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {order.deliveryAddress}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-serif text-lg font-bold text-primary">
                            ${Number(order.totalUsd).toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Commission: ${Number(order.commissionUsd).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
