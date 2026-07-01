import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SafeUser } from "@shared/models/auth";

const TOKEN_KEY = "auth_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

type AuthState = { user: SafeUser; roles: string[] };

async function fetchMe(): Promise<AuthState | null> {
  const token = getToken();
  if (!token) return null;

  const res = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    clearToken();
    return null;
  }

  if (!res.ok) {
    throw new Error(`${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  return { user: data.user as SafeUser, roles: (data.roles ?? []) as string[] };
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

async function loginRequest(input: LoginInput): Promise<{ user: SafeUser; token: string; roles: string[] }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Login failed");
  }

  return res.json();
}

async function registerRequest(input: RegisterInput): Promise<{ user: SafeUser; token: string; roles: string[] }> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Registration failed");
  }

  return res.json();
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: authState, isLoading } = useQuery<AuthState | null>({
    queryKey: ["/api/auth/me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: ({ user, token, roles }) => {
      setToken(token);
      queryClient.setQueryData(["/api/auth/me"], { user, roles });
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerRequest,
    onSuccess: ({ user, token, roles }) => {
      setToken(token);
      queryClient.setQueryData(["/api/auth/me"], { user, roles });
    },
  });

  const logout = () => {
    clearToken();
    queryClient.setQueryData(["/api/auth/me"], null);
    queryClient.clear();
  };

  return {
    user: authState?.user ?? null,
    roles: authState?.roles ?? [],
    isAdmin: authState?.roles?.includes("admin") ?? false,
    isLoading,
    isAuthenticated: !!authState?.user,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    logout,
  };
}
