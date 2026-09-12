"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";

// React Query's default retry (3x, doubling from 1s) doesn't know anything
// about our rate limiter: hammering a fresh request ~1s after a 429 just
// re-triggers it. Instead, honor the server's own Retry-After when we have
// one, and don't burn all 3 attempts retrying a limit that isn't going to
// clear that fast. Other 4xx errors (400/403/404/etc.) are never transient,
// so don't retry those at all — only network hiccups and 5xx are worth the
// default retry behavior.
const MAX_RETRIES = 3;

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 429) return failureCount < 2;
    if (error.status >= 400 && error.status < 500) return false;
  }
  return failureCount < MAX_RETRIES;
}

function getRetryDelay(attemptIndex: number, error: unknown): number {
  if (error instanceof ApiError && error.status === 429) {
    if (error.retryAfterSeconds !== null) {
      return error.retryAfterSeconds * 1000;
    }
    return 10_000;
  }
  return Math.min(1000 * 2 ** attemptIndex, 30_000);
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
            retry: shouldRetry,
            retryDelay: getRetryDelay,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
