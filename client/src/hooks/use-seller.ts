import { useQuery } from "@tanstack/react-query";
import type { Seller } from "@shared/schema";

async function fetchSeller(): Promise<Seller | null> {
  const res = await fetch("/api/sellers/me", {
    credentials: "include",
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
