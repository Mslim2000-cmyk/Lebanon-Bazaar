import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AdminRoute, ApprovedSellerRoute } from "@/components/auth/protected-route";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Products from "@/pages/products";
import ProductDetail from "@/pages/product-detail";
import Categories from "@/pages/categories";
import Sellers from "@/pages/sellers";
import SellerDetail from "@/pages/seller-detail";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import BecomeSeller from "@/pages/become-seller";
import SellerDashboard from "@/pages/seller/dashboard";
import ProductForm from "@/pages/seller/product-form";
import AdminDashboard from "@/pages/admin/index";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/products" component={Products} />
      <Route path="/products/:id" component={ProductDetail} />
      <Route path="/categories" component={Categories} />
      <Route path="/sellers" component={Sellers} />
      <Route path="/sellers/:id" component={SellerDetail} />
      <Route path="/cart" component={Cart} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/become-seller" component={BecomeSeller} />
      <Route path="/seller/dashboard" component={SellerDashboard} />
      <Route path="/seller/products/new">
        {() => <ApprovedSellerRoute><ProductForm /></ApprovedSellerRoute>}
      </Route>
      <Route path="/seller/products/:id/edit">
        {() => <ApprovedSellerRoute><ProductForm /></ApprovedSellerRoute>}
      </Route>
      <Route path="/admin">
        {() => <AdminRoute><AdminDashboard /></AdminRoute>}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
