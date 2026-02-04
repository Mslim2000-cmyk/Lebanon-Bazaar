import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  ShoppingBag, 
  ArrowLeft, 
  Truck, 
  Banknote, 
  CheckCircle,
  Loader2
} from "lucide-react";

interface CartItem {
  productId: string;
  sellerId: string;
  name: string;
  price: string;
  image: string;
  quantity: number;
}

const checkoutSchema = z.object({
  buyerName: z.string().min(2, "Name is required"),
  buyerPhone: z.string().min(8, "Valid phone number is required"),
  buyerEmail: z.string().email("Valid email is required").optional().or(z.literal("")),
  deliveryAddress: z.string().min(10, "Please provide a complete delivery address"),
  deliveryNotes: z.string().optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumbers, setOrderNumbers] = useState<string[]>([]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      buyerName: "",
      buyerPhone: "",
      buyerEmail: "",
      deliveryAddress: "",
      deliveryNotes: "",
    },
  });

  useEffect(() => {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    if (cart.length === 0 && !orderComplete) {
      setLocation("/cart");
    }
    setCartItems(cart);
  }, [setLocation, orderComplete]);

  const createOrderMutation = useMutation({
    mutationFn: async (data: CheckoutFormData) => {
      const groupedBySeller = cartItems.reduce((acc, item) => {
        if (!acc[item.sellerId]) {
          acc[item.sellerId] = [];
        }
        acc[item.sellerId].push(item);
        return acc;
      }, {} as Record<string, CartItem[]>);

      const orders = await Promise.all(
        Object.entries(groupedBySeller).map(async ([sellerId, items]) => {
          const subtotal = items.reduce(
            (sum, item) => sum + Number(item.price) * item.quantity,
            0
          );
          const commission = subtotal * 0.1; // 10% commission
          const total = subtotal;

          const orderData = {
            sellerId,
            buyerName: data.buyerName,
            buyerPhone: data.buyerPhone,
            buyerEmail: data.buyerEmail || null,
            deliveryAddress: data.deliveryAddress,
            deliveryNotes: data.deliveryNotes || null,
            subtotalUsd: subtotal.toString(),
            commissionUsd: commission.toString(),
            totalUsd: total.toString(),
            items: items.map((item) => ({
              productId: item.productId,
              productName: item.name,
              quantity: item.quantity,
              priceUsd: item.price,
            })),
          };

          const response = await apiRequest("POST", "/api/orders", orderData);
          return response;
        })
      );

      return orders;
    },
    onSuccess: (orders) => {
      localStorage.removeItem("cart");
      setOrderNumbers(orders.map((o: any) => o.orderNumber));
      setOrderComplete(true);
      toast({
        title: "Order placed successfully!",
        description: "The seller will contact you to confirm delivery.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to place order",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CheckoutFormData) => {
    createOrderMutation.mutate(data);
  };

  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );

  if (orderComplete) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center max-w-lg">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-bold mb-4">Order Confirmed!</h1>
          <p className="text-muted-foreground mb-6">
            Thank you for your order. The seller will contact you shortly to confirm delivery details.
          </p>
          <Card className="mb-6 text-left">
            <CardContent className="pt-6">
              <h3 className="font-medium mb-2">Order Reference{orderNumbers.length > 1 ? "s" : ""}</h3>
              {orderNumbers.map((num) => (
                <p key={num} className="font-mono text-primary">{num}</p>
              ))}
              <Separator className="my-4" />
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  <span>Payment: Cash on Delivery</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span>Delivery: Seller will contact you</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Link href="/products">
            <Button data-testid="button-continue-shopping">
              Continue Shopping
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <Link href="/cart">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cart
          </Button>
        </Link>

        <h1 className="font-serif text-2xl font-bold md:text-3xl mb-6">Checkout</h1>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="buyerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Your full name" 
                              {...field} 
                              data-testid="input-buyer-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="buyerPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="+961 XX XXX XXX" 
                                {...field}
                                data-testid="input-buyer-phone" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="buyerEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email (optional)</FormLabel>
                            <FormControl>
                              <Input 
                                type="email"
                                placeholder="your@email.com" 
                                {...field}
                                data-testid="input-buyer-email" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Delivery Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="deliveryAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Address *</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Building name, Street, Area, City..."
                              className="min-h-24"
                              {...field}
                              data-testid="input-delivery-address" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="deliveryNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Notes (optional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Any special instructions for delivery..."
                              {...field}
                              data-testid="input-delivery-notes" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card className="bg-accent/30">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <Banknote className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h4 className="font-medium">Cash on Delivery</h4>
                        <p className="text-sm text-muted-foreground">
                          Pay the delivery person when you receive your order. No online payment required.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full"
                  disabled={createOrderMutation.isPending}
                  data-testid="button-place-order"
                >
                  {createOrderMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Placing Order...
                    </>
                  ) : (
                    <>Place Order - ${subtotal.toFixed(2)}</>
                  )}
                </Button>
              </form>
            </Form>
          </div>

          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.productId} className="flex gap-3">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity} × ${Number(item.price).toFixed(2)}
                      </p>
                    </div>
                    <p className="text-sm font-medium">
                      ${(Number(item.price) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="text-sm text-muted-foreground">To be confirmed</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="font-serif text-xl text-primary">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
