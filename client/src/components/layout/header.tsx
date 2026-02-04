import { Link, useLocation } from "wouter";
import { Search, Menu, ShoppingBag, User, Store, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

export function Header() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Browse" },
    { href: "/categories", label: "Categories" },
    { href: "/sellers", label: "Artisans" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <div className="flex flex-col gap-6 pt-6">
                <Link href="/" onClick={() => setMobileMenuOpen(false)}>
                  <span className="font-serif text-2xl font-bold text-primary">Souq Artisan</span>
                </Link>
                <nav className="flex flex-col gap-2">
                  {navLinks.map((link) => (
                    <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}>
                      <span
                        className={`block rounded-md px-3 py-2 text-sm font-medium hover-elevate ${
                          location === link.href ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                        }`}
                        data-testid={`link-mobile-${link.label.toLowerCase()}`}
                      >
                        {link.label}
                      </span>
                    </Link>
                  ))}
                </nav>
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/">
            <span className="font-serif text-xl font-bold text-primary md:text-2xl" data-testid="link-logo">
              Souq Artisan
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors hover-elevate ${
                    location === link.href ? "text-foreground" : "text-muted-foreground"
                  }`}
                  data-testid={`link-nav-${link.label.toLowerCase()}`}
                >
                  {link.label}
                </span>
              </Link>
            ))}
          </nav>
        </div>

        <form onSubmit={handleSearch} className="hidden flex-1 max-w-md md:flex">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search handmade treasures..."
              className="w-full pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          <Link href="/cart">
            <Button variant="ghost" size="icon" data-testid="button-cart">
              <ShoppingBag className="h-5 w-5" />
            </Button>
          </Link>

          {isLoading ? (
            <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link href="/seller/dashboard">
                <Button variant="ghost" size="icon" data-testid="button-seller-dashboard">
                  <Store className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/admin">
                <Button variant="ghost" size="icon" data-testid="button-admin">
                  <LayoutDashboard className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/api/logout">
                <Button variant="outline" size="sm" data-testid="button-logout">
                  Logout
                </Button>
              </Link>
            </div>
          ) : (
            <Link href="/api/login">
              <Button data-testid="button-login">
                <User className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
