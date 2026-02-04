import { Link } from "wouter";
import { Heart, MapPin, Mail, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <h3 className="font-serif text-xl font-bold text-primary">Souq Artisan</h3>
            <p className="text-sm text-muted-foreground">
              Connecting you with Lebanon's finest artisans. Discover authentic handmade crafts, jewelry, and art from local talent.
            </p>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span>Made with</span>
              <Heart className="h-4 w-4 fill-primary text-primary" />
              <span>in Lebanon</span>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Quick Links</h4>
            <nav className="flex flex-col gap-2">
              <Link href="/products">
                <span className="text-sm text-muted-foreground hover:text-foreground" data-testid="link-footer-browse">
                  Browse Products
                </span>
              </Link>
              <Link href="/categories">
                <span className="text-sm text-muted-foreground hover:text-foreground" data-testid="link-footer-categories">
                  Categories
                </span>
              </Link>
              <Link href="/sellers">
                <span className="text-sm text-muted-foreground hover:text-foreground" data-testid="link-footer-artisans">
                  Our Artisans
                </span>
              </Link>
              <Link href="/become-seller">
                <span className="text-sm text-muted-foreground hover:text-foreground" data-testid="link-footer-become-seller">
                  Become a Seller
                </span>
              </Link>
            </nav>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Support</h4>
            <nav className="flex flex-col gap-2">
              <Link href="/about">
                <span className="text-sm text-muted-foreground hover:text-foreground">About Us</span>
              </Link>
              <Link href="/faq">
                <span className="text-sm text-muted-foreground hover:text-foreground">FAQ</span>
              </Link>
              <Link href="/contact">
                <span className="text-sm text-muted-foreground hover:text-foreground">Contact</span>
              </Link>
              <Link href="/terms">
                <span className="text-sm text-muted-foreground hover:text-foreground">Terms & Conditions</span>
              </Link>
            </nav>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Contact Us</h4>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Beirut, Lebanon</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>hello@souqartisan.com</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>+961 XX XXX XXX</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Souq Artisan. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
