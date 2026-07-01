import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSeller } from "@/hooks/use-seller";

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) setLocation("/login");
      else if (!isAdmin) setLocation("/");
    }
  }, [isLoading, isAuthenticated, isAdmin, setLocation]);

  if (isLoading) return <Spinner />;
  if (!isAuthenticated || !isAdmin) return null;
  return <>{children}</>;
}

export function ApprovedSellerRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isApproved, isLoading: sellerLoading } = useSeller();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && !sellerLoading) {
      if (!isAuthenticated) setLocation("/login");
      else if (!isApproved) setLocation("/seller/dashboard");
    }
  }, [authLoading, sellerLoading, isAuthenticated, isApproved, setLocation]);

  if (authLoading || sellerLoading) return <Spinner />;
  if (!isAuthenticated || !isApproved) return null;
  return <>{children}</>;
}
