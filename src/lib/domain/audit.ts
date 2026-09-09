import { prisma } from "../db/prisma";
import { redactSafeMetadata, hashIp } from "../security/crypto";
import { Prisma } from "@prisma/client";

export async function createAuditLog({
  actorUserId,
  actorRole,
  action,
  entity,
  entityId,
  requestId,
  details,
  ipAddress,
  userAgent,
  tx,
}: {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  requestId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const client = tx ?? prisma;
  const safeMetadata = redactSafeMetadata(details);
  const ipHash = ipAddress ? hashIp(ipAddress) : null;
  const userAgentSummary = userAgent ? userAgent.slice(0, 255) : null;

  await client.auditLog.create({
    data: {
      actorUserId: actorUserId ?? null,
      actorRole: actorRole ?? null,
      action,
      entity,
      entityId: entityId ?? null,
      requestId: requestId ?? null,
      safeMetadata: safeMetadata ? (safeMetadata as Prisma.InputJsonValue) : Prisma.DbNull,
      ipHash,
      userAgentSummary,
    },
  });
}
