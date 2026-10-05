import { randomInt } from "node:crypto";
import { prisma } from "../db/prisma";
import { createAuditLog } from "./audit";
import { WHEEL_AMOUNTS_CENTS, selectWheelPrize, validateWheelSettings, type WheelSetting } from "./wheel";

async function activeProgram() {
  const program = await prisma.program.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (!program) throw new Error("Programa ativo não encontrado.");
  return program;
}

export async function getWheelState() {
  const program = await activeProgram();
  const [stored, history] = await Promise.all([
    prisma.wheelPrize.findMany({ where: { programId: program.id } }),
    prisma.wheelSpin.findMany({ where: { programId: program.id, voidedAt: null }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, amountCents: true, createdAt: true, admin: { select: { name: true } } } }),
  ]);
  const prizes = WHEEL_AMOUNTS_CENTS.map((amountCents) => {
    const prize = stored.find((item) => item.amountCents === amountCents);
    return { amountCents, weight: prize?.weight ?? 0, limit: prize?.stockLimit ?? 0, awardedCount: prize?.awardedCount ?? 0 };
  });
  return { prizes, history };
}

export async function saveWheelSettings(settings: WheelSetting[], adminUserId: string) {
  const program = await activeProgram();
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Program" WHERE "id" = ${program.id} FOR UPDATE`;
    const existing = await tx.wheelPrize.findMany({ where: { programId: program.id } });
    validateWheelSettings(settings, existing);
    for (const setting of settings) {
      await tx.wheelPrize.upsert({
        where: { programId_amountCents: { programId: program.id, amountCents: setting.amountCents } },
        create: { programId: program.id, amountCents: setting.amountCents, weight: setting.weight, stockLimit: setting.limit },
        update: { weight: setting.weight, stockLimit: setting.limit },
      });
    }
    await createAuditLog({ actorUserId: adminUserId, actorRole: "ADMIN", action: "WHEEL_SETTINGS_UPDATED", entity: "Program", entityId: program.id, details: { settings }, tx });
  });
  return getWheelState();
}

export async function spinWheel(adminUserId: string) {
  const program = await activeProgram();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Program" WHERE "id" = ${program.id} FOR UPDATE`;
    const prizes = await tx.wheelPrize.findMany({ where: { programId: program.id }, orderBy: { amountCents: "asc" } });
    const available = prizes.filter((prize) => prize.weight > 0 && prize.awardedCount < prize.stockLimit);
    const totalWeight = available.reduce((sum, prize) => sum + prize.weight, 0);
    if (totalWeight < 1) throw new Error("Não há prêmios disponíveis. Configure chances e limites antes de girar.");
    const selected = selectWheelPrize(available.map((prize) => ({ ...prize, limit: prize.stockLimit })), randomInt(totalWeight));
    if (!selected) throw new Error("Nenhum prêmio disponível.");
    await tx.wheelPrize.update({ where: { id: selected.id }, data: { awardedCount: { increment: 1 } } });
    const spin = await tx.wheelSpin.create({ data: { programId: program.id, prizeId: selected.id, amountCents: selected.amountCents, adminUserId } });
    await createAuditLog({ actorUserId: adminUserId, actorRole: "ADMIN", action: "WHEEL_SPUN", entity: "WheelSpin", entityId: spin.id, details: { amountCents: spin.amountCents }, tx });
    return { id: spin.id, amountCents: spin.amountCents, sectorIndex: WHEEL_AMOUNTS_CENTS.indexOf(spin.amountCents as typeof WHEEL_AMOUNTS_CENTS[number]) };
  }, { timeout: 20000 });
}

export async function voidWheelSpins(input: { mode: "ONE"; spinId: string } | { mode: "ALL" }, adminUserId: string) {
  const program = await activeProgram();
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Program" WHERE "id" = ${program.id} FOR UPDATE`;
    const spins = await tx.wheelSpin.findMany({ where: {
      programId: program.id, voidedAt: null,
      ...(input.mode === "ONE" ? { id: input.spinId } : {}),
    }, select: { id: true, prizeId: true, amountCents: true } });
    if (!spins.length) throw new Error(input.mode === "ONE" ? "Este giro já foi excluído ou não foi encontrado." : "Não há giros para excluir.");
    const counts = new Map<string, number>();
    for (const spin of spins) counts.set(spin.prizeId, (counts.get(spin.prizeId) || 0) + 1);
    for (const [prizeId, count] of counts) {
      await tx.wheelPrize.update({ where: { id: prizeId }, data: { awardedCount: { decrement: count } } });
    }
    await tx.wheelSpin.updateMany({ where: { id: { in: spins.map((spin) => spin.id) }, voidedAt: null }, data: { voidedAt: new Date(), voidedById: adminUserId } });
    for (const spin of spins) {
      await createAuditLog({ actorUserId: adminUserId, actorRole: "ADMIN", action: "WHEEL_SPIN_VOIDED", entity: "WheelSpin", entityId: spin.id,
        details: { amountCents: spin.amountCents, stockReturned: true, mode: input.mode }, tx });
    }
  }, { timeout: 20000 });
  return getWheelState();
}
