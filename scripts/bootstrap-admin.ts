import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "../src/lib/db/prisma";
import { normalizeEmail } from "../src/lib/security/crypto";
import { createAuditLog } from "../src/lib/domain/audit";

async function main() {
  const emailArg = process.argv.find((arg) => arg.startsWith("--email="))?.split("=")[1];
  const targetEmail = emailArg || process.env.BOOTSTRAP_ADMIN_EMAIL;

  if (!targetEmail) {
    console.error("Erro: E-mail de bootstrap não fornecido via --email=<email> ou BOOTSTRAP_ADMIN_EMAIL.");
    process.exit(1);
  }

  const normalized = normalizeEmail(targetEmail);

  // 1. Verifica se já existe QUALQUER administrador no sistema
  const existingAdmin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
  });

  if (existingAdmin) {
    console.log("Bootstrap ignorado: Já existe um administrador cadastrado no sistema.");
    process.exit(0);
  }

  // 2. Cria ou promove o usuário auditavelmente
  const user = await prisma.user.upsert({
    where: { email: normalized },
    create: {
      email: normalized,
      name: "Administrador JRC",
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
    },
    update: {
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
    },
  });

  await createAuditLog({
    actorUserId: user.id,
    actorRole: "ADMIN",
    action: "BOOTSTRAP_ADMIN_CREATED",
    entity: "User",
    entityId: user.id,
    details: { email: normalized },
  });

  console.log(`Sucesso: Administrador inicial configurado para [${normalized}]. Acesse o sistema via OTP.`);
}

main()
  .catch((e) => {
    console.error("Falha no bootstrap administrativo:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
