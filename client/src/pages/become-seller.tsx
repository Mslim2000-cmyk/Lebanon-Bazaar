import { useLocation } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { 
  Store, 
  Loader2,
  Sparkles,
  HandHeart,
  TrendingUp,
  Users
} from "lucide-react";

const sellerSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  businessNameAr: z.string().optional(),
  bio: z.string().optional(),
  phone: z.string().min(8, "Valid phone number is required"),
  location: z.string().min(2, "Location is required"),
});

type SellerFormData = z.infer<typeof sellerSchema>;

export default function BecomeSeller() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<SellerFormData>({
    resolver: zodResolver(sellerSchema),
    defaultValues: {
      businessName: "",
      businessNameAr: "",
      bio: "",
      phone: "",
      location: "",
    },
  });

  const createSellerMutation = useMutation({
    mutationFn: async (data: SellerFormData) => {
      const sellerData = {
        businessName: data.businessName,
        businessNameAr: data.businessNameAr || null,
        phone: data.phone,
        location: data.location,
        bio: data.bio || null,
      };
      return await apiRequest("POST", "/api/sellers/apply", sellerData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/me"] });
      toast({
        title: "Application submitted!",
        description: "We'll review your application and get back to you soon.",
      });
      setLocation("/seller/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit application",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SellerFormData) => {
    createSellerMutation.mutate(data);
  };

  if (authLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        </div>
      </MainLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <Store className="h-16 w-16 text-primary mx-auto mb-6" />
            <h1 className="font-serif text-2xl font-bold md:text-3xl mb-4">
              Become an Artisan Seller
            </h1>
            <p className="text-muted-foreground mb-8">
              Join our community of talented Lebanese artisans. Share your craft with customers across Lebanon.
            </p>
            <Button size="lg" asChild>
              <a href="/api/login" data-testid="button-login-to-sell">
                Sign In to Get Started
              </a>
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-3 mt-16 max-w-4xl mx-auto">
            <Card className="text-center">
              <CardContent className="pt-8 pb-6">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Showcase Your Craft</h3>
                <p className="text-sm text-muted-foreground">
                  Create beautiful product listings with photos and descriptions
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-8 pb-6">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Reach Customers</h3>
                <p className="text-sm text-muted-foreground">
                  Connect with buyers looking for unique handmade products
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-8 pb-6">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Grow Your Business</h3>
                <p className="text-sm text-muted-foreground">
                  Simple tools to manage orders and grow your craft business
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <Store className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="font-serif text-2xl font-bold md:text-3xl">
            Become an Artisan Seller
          </h1>
          <p className="mt-2 text-muted-foreground">
            Tell us about yourself and your craft
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Seller Application</CardTitle>
            <CardDescription>
              Fill out the form below to apply. We'll review your application within 24-48 hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business/Shop Name *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Your artisan shop name" 
                          {...field}
                          data-testid="input-business-name" 
                        />
                      </FormControl>
                      <FormDescription>
                        This is how customers will see your shop
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessNameAr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name in Arabic (optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="اسم المتجر بالعربية" 
                          dir="rtl"
                          {...field}
                          data-testid="input-business-name-ar" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>About Your Craft (optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tell us about yourself and your craft. What makes your work unique?"
                          className="min-h-32"
                          {...field}
                          data-testid="input-bio" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="+961 XX XXX XXX" 
                            {...field}
                            data-testid="input-phone" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="City, Lebanon" 
                            {...field}
                            data-testid="input-location" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full"
                  disabled={createSellerMutation.isPending}
                  data-testid="button-submit-application"
                >
                  {createSellerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
