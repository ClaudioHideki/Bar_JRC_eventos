import { UserRole, UserStatus, ProgramStatus, EventStatus, InvitationStatus } from "@prisma/client";
import { prisma } from "../src/lib/db/prisma";
import { hashInvitationToken } from "../src/lib/security/crypto";
import { hashPassword } from "better-auth/crypto";

async function main() {
  console.log("Iniciando seed de homologaÃ§Ã£o com dados para teste...");

  // 1. Programa JRC 2026
  const program = await prisma.program.upsert({
    where: { slug: "passaporte-jrc-2026" },
    create: {
      name: "Passaporte JRC 2026",
      slug: "passaporte-jrc-2026",
      capacity: 999999,
      status: ProgramStatus.ACTIVE,
    },
    update: {
      capacity: 999999,
      status: ProgramStatus.ACTIVE,
    },
  });

  // 2. Administradores FictÃ­cios para Teste
  const adminPasswordHash = await hashPassword("admin123");
  const admins = [
    { email: "admin@jrc.com", name: "Administrador JRC" },
    { email: "admin@jrc.com.br", name: "Administrador JRC" },
    { email: "admin.homolog@exemplo-jrc.local", name: "Administrador HomologaÃ§Ã£o" },
  ];

  for (const adm of admins) {
    const user = await prisma.user.upsert({
      where: { email: adm.email },
      create: {
        email: adm.email,
        name: adm.name,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
      update: {
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.account.upsert({
      where: {
        providerId_accountId: {
          providerId: "credential",
          accountId: user.id,
        },
      },
      create: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        issuer: "local:credential",
        password: adminPasswordHash,
      },
      update: {
        issuer: "local:credential",
        password: adminPasswordHash,
      },
    });
  }

  // 3. Atendentes FictÃ­cios para Teste
  const attendantPasswordHash = await hashPassword("atendente123");
  const attendants = [
    { email: "atendente@jrc.com", name: "Atendente RecepÃ§Ã£o JRC" },
    { email: "atendente@jrc.com.br", name: "Atendente RecepÃ§Ã£o JRC" },
    { email: "atendente.homolog@exemplo-jrc.local", name: "Atendente HomologaÃ§Ã£o" },
  ];

  for (const att of attendants) {
    const user = await prisma.user.upsert({
      where: { email: att.email },
      create: {
        email: att.email,
        name: att.name,
        role: UserRole.ATTENDANT,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
      update: {
        role: UserRole.ATTENDANT,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.account.upsert({
      where: {
        providerId_accountId: {
          providerId: "credential",
          accountId: user.id,
        },
      },
      create: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        issuer: "local:credential",
        password: attendantPasswordHash,
      },
      update: {
        issuer: "local:credential",
        password: attendantPasswordHash,
      },
    });
  }

  // 4. 12 Encontros Mensais do Bar JRC (Janeiro a Dezembro)
  console.log("Semeando os 12 eventos mensais do Bar JRC...");
  const months = [
    { num: "01", name: "Bar JRC - Setembro 2026", desc: "1Âº Encontro Mensal do Bar JRC", year: 2026, month: 8 },
    { num: "02", name: "Bar JRC - Outubro 2026", desc: "2Âº Encontro Mensal do Bar JRC", year: 2026, month: 9 },
    { num: "03", name: "Bar JRC - Novembro 2026", desc: "3Âº Encontro Mensal do Bar JRC", year: 2026, month: 10 },
    { num: "04", name: "Bar JRC - Dezembro 2026", desc: "4Âº Encontro Mensal do Bar JRC", year: 2026, month: 11 },
    { num: "05", name: "Bar JRC - Janeiro 2027", desc: "5Âº Encontro Mensal do Bar JRC", year: 2027, month: 0 },
    { num: "06", name: "Bar JRC - Fevereiro 2027", desc: "6Âº Encontro Mensal do Bar JRC", year: 2027, month: 1 },
    { num: "07", name: "Bar JRC - MarÃ§o 2027", desc: "7Âº Encontro Mensal do Bar JRC", year: 2027, month: 2 },
    { num: "08", name: "Bar JRC - Abril 2027", desc: "8Âº Encontro Mensal do Bar JRC", year: 2027, month: 3 },
    { num: "09", name: "Bar JRC - Maio 2027", desc: "9Âº Encontro Mensal do Bar JRC", year: 2027, month: 4 },
    { num: "10", name: "Bar JRC - Junho 2027", desc: "10Âº Encontro Mensal do Bar JRC", year: 2027, month: 5 },
    { num: "11", name: "Bar JRC - Julho 2027", desc: "11Âº Encontro Mensal do Bar JRC", year: 2027, month: 6 },
    { num: "12", name: "Bar JRC - Agosto 2027", desc: "12Âº Encontro Mensal do Bar JRC", year: 2027, month: 7 },
  ];

  for (let idx = 0; idx < months.length; idx++) {
    const m = months[idx];
    const startDate = new Date(m.year, m.month, 15, 19, 0, 0);
    const endDate = new Date(m.year, m.month, 15, 23, 59, 0);

    await prisma.event.upsert({
      where: { id: `event-bar-jrc-${m.num}` },
      create: {
        id: `event-bar-jrc-${m.num}`,
        programId: program.id,
        name: m.name,
        description: m.desc,
        location: "EspaÃ§o Bar JRC",
        startDate,
        endDate,
        status: EventStatus.ACTIVE,
        orderIndex: idx + 1,
        stampIcon: "standard",
        stampColor: "#cdaa63",
      },
      update: {
        name: m.name,
        description: m.desc,
        location: "EspaÃ§o Bar JRC",
        startDate,
        endDate,
        status: EventStatus.ACTIVE,
        orderIndex: idx + 1,
      },
    });
  }

  // 5. 30 Convites com Tokens PrevisÃ­veis para HomologaÃ§Ã£o e Testes
  console.log("Semeando os 30 convites de participantes...");
  for (let i = 1; i <= 30; i++) {
    const num = i.toString().padStart(2, "0");
    const token = `convite-participante-${num}`;
    const tokenHash = hashInvitationToken(token);

    await prisma.invitation.upsert({
      where: { id: `invitation-participante-${num}` },
      create: {
        id: `invitation-participante-${num}`,
        programId: program.id,
        tokenHash,
        status: InvitationStatus.AVAILABLE,
      },
      update: {
        tokenHash,
        status: InvitationStatus.AVAILABLE,
      },
    });
  }

  console.log("\n========================================================");
  console.log("âœ… Seed concluÃ­do com sucesso!");
  console.log("========================================================");
  console.log("ðŸ›¡ï¸ ADMIN: admin@jrc.com.br (Login em /login)");
  console.log("ðŸ“± ATENDENTE: atendente@jrc.com.br (Login em /login)");
  console.log("ðŸŽŸï¸ CONVITE 01: http://localhost:3000/convite/convite-participante-01");
  console.log("ðŸŽŸï¸ CONVITE 02: http://localhost:3000/convite/convite-participante-02");
  console.log("... atÃ© convite-participante-30");
  console.log("========================================================\n");
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
