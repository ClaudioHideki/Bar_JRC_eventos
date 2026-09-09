import { UserRole, UserStatus, ProgramStatus, EventStatus, InvitationStatus } from "@prisma/client";
import { prisma } from "../src/lib/db/prisma";
import { hashInvitationToken } from "../src/lib/security/crypto";
import { hashPassword } from "better-auth/crypto";

async function main() {
  console.log("Iniciando seed de homologação com dados para teste...");

  // 1. Programa JRC 2026
  const program = await prisma.program.upsert({
    where: { slug: "passaporte-jrc-2026" },
    create: {
      name: "Passaporte JRC 2026",
      slug: "passaporte-jrc-2026",
      capacity: 30,
      status: ProgramStatus.ACTIVE,
    },
    update: {},
  });

  // 2. Administradores Fictícios para Teste
  const adminPasswordHash = await hashPassword("admin123");
  const admins = [
    { email: "admin@jrc.com", name: "Administrador JRC" },
    { email: "admin@jrc.com.br", name: "Administrador JRC" },
    { email: "admin.homolog@exemplo-jrc.local", name: "Administrador Homologação" },
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

  // 3. Atendentes Fictícios para Teste
  const attendantPasswordHash = await hashPassword("atendente123");
  const attendants = [
    { email: "atendente@jrc.com", name: "Atendente Recepção JRC" },
    { email: "atendente@jrc.com.br", name: "Atendente Recepção JRC" },
    { email: "atendente.homolog@exemplo-jrc.local", name: "Atendente Homologação" },
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
    { num: "01", name: "Bar JRC - Janeiro", desc: "1º Encontro Mensal do Bar JRC", month: 0 },
    { num: "02", name: "Bar JRC - Fevereiro", desc: "2º Encontro Mensal do Bar JRC", month: 1 },
    { num: "03", name: "Bar JRC - Março", desc: "3º Encontro Mensal do Bar JRC", month: 2 },
    { num: "04", name: "Bar JRC - Abril", desc: "4º Encontro Mensal do Bar JRC", month: 3 },
    { num: "05", name: "Bar JRC - Maio", desc: "5º Encontro Mensal do Bar JRC", month: 4 },
    { num: "06", name: "Bar JRC - Junho", desc: "6º Encontro Mensal do Bar JRC", month: 5 },
    { num: "07", name: "Bar JRC - Julho", desc: "7º Encontro Mensal do Bar JRC", month: 6 },
    { num: "08", name: "Bar JRC - Agosto", desc: "8º Encontro Mensal do Bar JRC", month: 7 },
    { num: "09", name: "Bar JRC - Setembro", desc: "9º Encontro Mensal do Bar JRC", month: 8 },
    { num: "10", name: "Bar JRC - Outubro", desc: "10º Encontro Mensal do Bar JRC", month: 9 },
    { num: "11", name: "Bar JRC - Novembro", desc: "11º Encontro Mensal do Bar JRC", month: 10 },
    { num: "12", name: "Bar JRC - Dezembro (Encontro Final)", desc: "12º Encontro: Escolha do tema e celebração dos 40 Anos JRC", month: 11 },
  ];

  const currentYear = new Date().getFullYear();
  for (let idx = 0; idx < months.length; idx++) {
    const m = months[idx];
    const startDate = new Date(currentYear, m.month, 15, 19, 0, 0);
    const endDate = new Date(currentYear, m.month, 15, 23, 59, 0);

    await prisma.event.upsert({
      where: { id: `event-bar-jrc-${m.num}` },
      create: {
        id: `event-bar-jrc-${m.num}`,
        programId: program.id,
        name: m.name,
        description: m.desc,
        location: "Espaço Bar JRC",
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
        status: EventStatus.ACTIVE,
        orderIndex: idx + 1,
      },
    });
  }

  // 5. 30 Convites com Tokens Previsíveis para Homologação e Testes
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
  console.log("✅ Seed concluído com sucesso!");
  console.log("========================================================");
  console.log("🛡️ ADMIN: admin@jrc.com.br (Login em /login)");
  console.log("📱 ATENDENTE: atendente@jrc.com.br (Login em /login)");
  console.log("🎟️ CONVITE 01: http://localhost:3000/convite/convite-participante-01");
  console.log("🎟️ CONVITE 02: http://localhost:3000/convite/convite-participante-02");
  console.log("... até convite-participante-30");
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
