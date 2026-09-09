"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function AdminLogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } catch {
      // Ignora erro se sessão já foi revogada
    }
    router.push("/login");
  };

  return (
    <button
      onClick={handleLogout}
      className="rounded-xl border border-muted/30 px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-muted/60 transition cursor-pointer"
    >
      Sair
    </button>
  );
}
