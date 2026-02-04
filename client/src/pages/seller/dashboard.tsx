import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Package, 
  ShoppingCart, 
  DollarSign, 
  Plus,
  Eye,
  Edit,
  Loader2,
  Store,
  AlertCircle
} from "lucide-react";
import type { Seller, Product, Order } from "@shared/schema";

export default function SellerDashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: seller, isLoading: sellerLoading, error: sellerError } = useQuery<Seller>({
    queryKey: ["/api/sellers/me"],
    enabled: isAuthenticated,
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/sellers/me/products"],
    enabled: !!seller && seller.status === "approved",
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/sellers/me/orders"],
    enabled: !!seller && seller.status === "approved",
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/me/orders"] });
      toast({ title: "Order status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update order", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/api/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || sellerLoading) {
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

  if (!seller) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Store className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          <h1 className="font-serif text-2xl font-bold mb-4">No Seller Account</h1>
          <p className="text-muted-foreground mb-6">
            You haven't registered as a seller yet. Apply now to start selling your crafts!
          </p>
          <Link href="/become-seller">
            <Button data-testid="button-become-seller">
              Become a Seller
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  if (seller.status === "pending") {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-6" />
          <h1 className="font-serif text-2xl font-bold mb-4">Application Pending</h1>
          <p className="text-muted-foreground mb-4">
            Your seller application is currently under review.
          </p>
          <p className="text-sm text-muted-foreground">
            We'll notify you once your application has been approved.
          </p>
        </div>
      </MainLayout>
    );
  }

  if (seller.status === "rejected") {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-6" />
          <h1 className="font-serif text-2xl font-bold mb-4">Application Not Approved</h1>
          <p className="text-muted-foreground mb-6">
            Unfortunately, your seller application was not approved. 
            Please contact us for more information.
          </p>
        </div>
      </MainLayout>
    );
  }

  const totalProducts = products?.length || 0;
  const totalOrders = orders?.length || 0;
  const pendingOrders = orders?.filter(o => o.status === "pending").length || 0;
  const totalRevenue = orders
    ?.filter(o => o.status === "delivered")
    .reduce((sum, o) => sum + Number(o.subtotalUsd), 0) || 0;

  const getStatusBadge = (status: string) => {
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-2xl font-bold md:text-3xl">Seller Dashboard</h1>
            <p className="text-muted-foreground mt-1">{seller.businessName}</p>
          </div>
          <Link href="/seller/products/new">
            <Button data-testid="button-add-product">
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Products</p>
                  <p className="text-2xl font-bold">{totalProducts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-amber-500/10">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{pendingOrders}</p>
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
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products">Products</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-6">
            {ordersLoading ? (
              <div className="space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-32 mb-2" />
                      <Skeleton className="h-4 w-48" />
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
                            {getStatusBadge(order.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {order.buyerName} • {order.buyerPhone}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {order.deliveryAddress}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-serif text-lg font-bold text-primary">
                            ${Number(order.totalUsd).toFixed(2)}
                          </p>
                          {order.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => updateOrderStatusMutation.mutate({ 
                                orderId: order.id, 
                                status: "confirmed" 
                              })}
                              disabled={updateOrderStatusMutation.isPending}
                              data-testid={`button-confirm-${order.id}`}
                            >
                              Confirm
                            </Button>
                          )}
                          {order.status === "confirmed" && (
                            <Button
                              size="sm"
                              onClick={() => updateOrderStatusMutation.mutate({ 
                                orderId: order.id, 
                                status: "shipped" 
                              })}
                              disabled={updateOrderStatusMutation.isPending}
                              data-testid={`button-ship-${order.id}`}
                            >
                              Mark Shipped
                            </Button>
                          )}
                          {order.status === "shipped" && (
                            <Button
                              size="sm"
                              onClick={() => updateOrderStatusMutation.mutate({ 
                                orderId: order.id, 
                                status: "delivered" 
                              })}
                              disabled={updateOrderStatusMutation.isPending}
                              data-testid={`button-deliver-${order.id}`}
                            >
                              Mark Delivered
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            {productsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array(3).fill(0).map((_, i) => (
                  <Card key={i}>
                    <Skeleton className="aspect-video" />
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
                  <p className="text-muted-foreground mb-4">No products yet</p>
                  <Link href="/seller/products/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Product
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {products?.map((product) => (
                  <Card key={product.id} data-testid={`card-product-${product.id}`}>
                    <div className="aspect-video overflow-hidden bg-muted">
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-medium truncate">{product.name}</h3>
                          <p className="font-serif text-lg font-bold text-primary">
                            ${Number(product.priceUsd).toFixed(2)}
                          </p>
                        </div>
                        <Badge variant={product.isAvailable ? "default" : "secondary"}>
                          {product.isAvailable ? "Available" : "Sold Out"}
                        </Badge>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Link href={`/products/${product.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/seller/products/${product.id}/edit`}>
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
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
