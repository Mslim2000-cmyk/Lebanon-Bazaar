import { useQuery } from "@tanstack/react-query";
import type { Seller } from "@shared/schema";
import { getToken } from "@/hooks/use-auth";

async function fetchSeller(): Promise<Seller | null> {
  const token = getToken();
  const res = await fetch("/api/sellers/me", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401 || res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error("Failed to fetch seller");
  }

  return res.json();
}

export function useSeller() {
  const { data: seller, isLoading } = useQuery<Seller | null>({
    queryKey: ["/api/sellers/me"],
    queryFn: fetchSeller,
    retry: false,
  });

  const status = seller?.status;

  return {
    seller,
    status,
    isLoading,
    isApproved: status === "approved",
    isPending: status === "pending",
    isRejected: status === "rejected",
  };
}
