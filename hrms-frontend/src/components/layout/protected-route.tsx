"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/constants/routes";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(ROUTES.LOGIN);
    } else if (status === "authenticated" && user?.mustChangePassword) {
      router.replace(ROUTES.SET_PASSWORD);
    }
  }, [status, user, router]);

  if (
    status === "loading" ||
    status === "unauthenticated" ||
    user?.mustChangePassword
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center" suppressHydrationWarning>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
