import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { Seller } from "@shared/schema";

export function useSeller() {
  const { isAuthenticated } = useAuth();

  const { data: seller, isLoading } = useQuery<Seller>({
    queryKey: ["/api/sellers/me"],
    enabled: isAuthenticated,
  });

  const status = seller?.status ?? null;

  return {
    seller: seller ?? null,
    status,
    isApproved: status === "approved",
    isPending: status === "pending",
    isRejected: status === "rejected",
    isLoading,
  };
}
