import { InvitationStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import {
  encryptInvitationToken,
  generateSecureToken,
  hashInvitationToken,
} from "@/lib/security/crypto";

function getBaseUrl(req: NextRequest) {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    req.nextUrl.origin ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json(
        {
          error:
            "Acesso permitido somente para administradores.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();

    const invitationId =
      typeof body?.invitationId === "string"
        ? body.invitationId.trim()
        : "";

    if (!invitationId) {
      return NextResponse.json(
        { error: "Convite não informado." },
        { status: 400 }
      );
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      select: {
        id: true,
        status: true,
        claimedName: true,
        claimedEmail: true,
        phone: true,
        usedById: true,
        usedAt: true,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Convite não encontrado." },
        { status: 404 }
      );
    }

    if (
      invitation.status === InvitationStatus.USED ||
      invitation.usedById ||
      invitation.usedAt
    ) {
      return NextResponse.json(
        {
          error:
            "Este convite já foi utilizado e não pode receber um novo link.",
        },
        { status: 409 }
      );
    }

    if (invitation.status === InvitationStatus.REVOKED) {
      return NextResponse.json(
        {
          error:
            "Este convite está revogado e não pode receber um novo link.",
        },
        { status: 409 }
      );
    }

    const rawToken = generateSecureToken();
    const tokenHash = hashInvitationToken(rawToken);
    const tokenEncrypted =
      encryptInvitationToken(rawToken);

    const expiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    const updated = await prisma.invitation.update({
      where: {
        id: invitation.id,
      },
      data: {
        tokenHash,
        tokenEncrypted,
        status: InvitationStatus.SENT,
        sentAt:
          invitation.status === InvitationStatus.SENT
            ? undefined
            : new Date(),
        expiresAt,
      },
      select: {
        id: true,
        status: true,
        claimedName: true,
        claimedEmail: true,
        phone: true,
        expiresAt: true,
      },
    });

    const inviteLink = `${getBaseUrl(
      req
    )}/convite/${rawToken}`;

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      claimedName: updated.claimedName,
      claimedEmail: updated.claimedEmail,
      phone: updated.phone,
      inviteLink,
      expiresAt: updated.expiresAt,
    });
  } catch (error) {
    console.error(
      "Erro ao gerar novo link de convite:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível gerar um novo link para o convite.",
      },
      { status: 500 }
    );
  }
}