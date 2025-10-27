import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "./supabase";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get the current session to include auth token
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers: Record<string, string> = {};
  
  // Add Content-Type header if there's data
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Add Authorization header if user is logged in
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

export const getQueryFn: <T>() => QueryFunction<T> =
  () =>
  async ({ queryKey }) => {
    // Get the current session to include auth token
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers: Record<string, string> = {};
    
    // Add Authorization header if user is logged in
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers,
    });

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn(),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
