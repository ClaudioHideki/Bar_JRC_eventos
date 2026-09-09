import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { auth } from "./auth";
import { prisma } from "../db/prisma";
import { UserRole, UserStatus } from "@prisma/client";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
}

export async function getServerSession(
  reqOrHeaders?: Headers | NextRequest
): Promise<{ user: CurrentUser } | null> {
  let reqHeaders: Headers;
  if (reqOrHeaders && "headers" in reqOrHeaders && typeof reqOrHeaders.headers?.get === "function") {
    reqHeaders = reqOrHeaders.headers;
  } else if (reqOrHeaders instanceof Headers) {
    reqHeaders = reqOrHeaders;
  } else {
    try {
      reqHeaders = await headers();
    } catch {
      return null;
    }
  }

  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  let userId = session?.user?.id;

  // Fallback robusto: se o getSession não identificou mas há cookie de sessão ativo no banco
  if (!userId) {
    const cookieHeader = reqHeaders.get("cookie") || "";
    const match = cookieHeader.match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/);
    if (match) {
      let rawToken = decodeURIComponent(match[1]).trim();
      const prefixToken = rawToken.includes(".") ? rawToken.split(".")[0] : rawToken;
      const dbSession = await prisma.session.findFirst({
        where: {
          OR: [
            { token: rawToken },
            { token: prefixToken },
          ],
          expiresAt: { gt: new Date() },
        },
      });
      if (dbSession) {
        userId = dbSession.userId;
      }
    }
  }

  if (!userId) {
    return null;
  }

  // Consulta atualizada do banco para garantir status e papel em tempo real
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      emailVerified: true,
    },
  });

  if (!dbUser || dbUser.status !== UserStatus.ACTIVE) {
    return null;
  }

  return { user: dbUser };
}

export async function requireUser(): Promise<CurrentUser> {
  const session = await getServerSession();
  if (!session) {
    throw new Error("Não autenticado ou conta inativa.");
  }
  return session.user;
}

export async function requireRole(allowedRoles: UserRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!allowedRoles.includes(user.role)) {
    throw new Error("Acesso não autorizado para este perfil.");
  }
  return user;
}

export async function requireParticipant(): Promise<CurrentUser> {
  return requireRole([UserRole.PARTICIPANT]);
}

export async function requireAttendant(): Promise<CurrentUser> {
  return requireRole([UserRole.ATTENDANT, UserRole.ADMIN]);
}

export async function requireAdmin(): Promise<CurrentUser> {
  return requireRole([UserRole.ADMIN]);
}
