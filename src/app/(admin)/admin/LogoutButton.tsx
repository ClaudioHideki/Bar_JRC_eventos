"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <button
      onClick={handleLogout}
      className="rounded-xl border border-muted/30 px-3 py-1.5 text-xs text-muted hover:text-foreground transition"
    >
      Sair
    </button>
  );
}
