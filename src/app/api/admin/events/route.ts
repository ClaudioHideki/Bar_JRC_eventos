import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getOrCreateDefaultProgram } from "@/lib/domain/invitations";
import { prisma } from "@/lib/db/prisma";
import { UserRole, EventStatus } from "@prisma/client";
import { createAuditLog } from "@/lib/domain/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }

    const events = await prisma.event.findMany({
      orderBy: { orderIndex: "asc" },
      include: {
        _count: {
          select: { stamps: { where: { status: "CONFIRMED" } } },
        },
      },
    });

    return NextResponse.json(events, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Erro ao listar eventos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, location, startDate, endDate, stampIcon, stampColor, themeImageUrl } = body;

    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: "Nome, data inicial e final são obrigatórios." }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      return NextResponse.json({ error: "A data final deve ser posterior à data inicial." }, { status: 400 });
    }

    const program = await getOrCreateDefaultProgram();
    const lastEvent = await prisma.event.findFirst({
      where: { programId: program.id },
      orderBy: { orderIndex: "desc" },
    });
    const orderIndex = (lastEvent?.orderIndex ?? 0) + 1;

    const event = await prisma.event.create({
      data: {
        programId: program.id,
        name: name.trim(),
        description: description?.trim() || null,
        location: location?.trim() || null,
        startDate: start,
        endDate: end,
        status: EventStatus.ACTIVE,
        orderIndex,
        stampIcon: stampIcon || "standard",
        stampColor: stampColor || "#cdaa63",
        themeImageUrl: themeImageUrl?.trim() || null,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao criar evento.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }

    const body = await req.json();
    const { eventId, status, name, description, location, startDate, endDate, themeImageUrl } = body;

    if (!eventId) {
      return NextResponse.json({ error: "ID do evento é obrigatório." }, { status: 400 });
    }

    const updateData: {
      status?: EventStatus;
      name?: string;
      description?: string | null;
      location?: string | null;
      startDate?: Date;
      endDate?: Date;
      themeImageUrl?: string | null;
    } = {};

    if (status) updateData.status = status;
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (location !== undefined) updateData.location = location?.trim() || null;
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (themeImageUrl !== undefined) updateData.themeImageUrl = themeImageUrl?.trim() || null;

    const event = await prisma.event.update({
      where: { id: eventId },
      data: updateData,
    });

    return NextResponse.json(event, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar evento.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }

    const body = await req.json();
    const { eventId, forceDelete } = body;

    if (!eventId) {
      return NextResponse.json({ error: "ID do evento é obrigatório." }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { _count: { select: { stamps: true } } },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    if (event._count.stamps > 0 && !forceDelete) {
      return NextResponse.json(
        {
          error: `Este evento possui ${event._count.stamps} presença(s) registrada(s).`,
          hasStamps: true,
          stampCount: event._count.stamps,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      if (forceDelete) {
        await tx.stamp.deleteMany({
          where: { eventId },
        });
      }

      await tx.event.delete({
        where: { id: eventId },
      });

      await createAuditLog({
        actorUserId: session.user.id,
        actorRole: "ADMIN",
        action: "EVENT_DELETED",
        entity: "Event",
        entityId: eventId,
        details: { name: event.name, forceDelete: !!forceDelete, stampsRemoved: event._count.stamps },
        tx,
      });
    });

    return NextResponse.json({ success: true, message: `Evento "${event.name}" excluído com sucesso.` }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao excluir evento.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
