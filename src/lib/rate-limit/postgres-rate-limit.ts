import { prisma } from "../db/prisma";
import { hashRateLimitKey } from "../security/crypto";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Limitador de taxa baseado em PostgreSQL (tabela RateLimitBucket).
 * Opera em janela deslizante com chave protegida por HMAC.
 */
export async function checkRateLimit({
  key,
  limit,
  windowSeconds,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const keyHash = hashRateLimitKey(key);
  const now = new Date();
  const expireAt = new Date(now.getTime() + windowSeconds * 1000);

  // Transação atômica para ler ou inicializar o bucket
  const bucket = await prisma.$transaction(async (tx) => {
    const existing = await tx.rateLimitBucket.findUnique({
      where: { keyHash },
    });

    if (!existing || existing.expireAt < now) {
      // Bucket novo ou expirado: reinicia contador
      return tx.rateLimitBucket.upsert({
        where: { keyHash },
        create: { keyHash, points: 1, expireAt },
        update: { points: 1, expireAt },
      });
    }

    // Bucket ativo: incrementa pontuação
    return tx.rateLimitBucket.update({
      where: { keyHash },
      data: { points: { increment: 1 } },
    });
  });

  const allowed = bucket.points <= limit;
  const remaining = Math.max(0, limit - bucket.points);

  return {
    allowed,
    remaining,
    resetAt: bucket.expireAt,
  };
}

export async function cleanupExpiredBuckets(): Promise<number> {
  const result = await prisma.rateLimitBucket.deleteMany({
    where: {
      expireAt: { lt: new Date() },
    },
  });
  return result.count;
}
