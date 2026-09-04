# Plano de Implementação Técnico — Passaporte de Eventos JRC

Sistema web corporativo para emissão, validação e auditoria de passaportes de eventos para participantes convidados da JRC.

---

## 1. Stack Tecnológica e Versões Fixadas

| Componente | Tecnologia | Versão Fixada | Justificativa Técnica |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js (Debian slim) | `24.18.0 LTS` | LTS estável, compatível com OpenSSL 3 e engines nativas |
| **Framework** | Next.js (App Router) | `14.2.24` | Estabilidade comprovada em produção com Server Actions e Route Handlers |
| **Biblioteca UI** | React / React DOM | `18.3.1` | Compatibilidade estrita com `@yudiel/react-qr-scanner` e ecossistema Next.js |
| **Linguagem** | TypeScript | `5.7.3` | Tipagem estrita (`strict: true`, `noImplicitAny: true`) |
| **Estilização** | Tailwind CSS | `3.4.17` | Utilização de design tokens CSS customizados JRC |
| **Banco de Dados** | PostgreSQL | `16` | Suporte nativo a índices parciais, transações atômicas e serializáveis |
| **ORM** | Prisma / @prisma/client | `6.4.1` | Suporte maduro a migrations e adaptador oficial Better Auth |
| **Autenticação** | Better Auth | `1.7.2` | Sessões seguras, plugin oficial Email OTP hashed, Prisma adapter |
| **Validação** | Zod | `3.24.2` | Schemas estritos com inferência de tipos |
| **QR Code (Geração)** | `qrcode` / `@types/qrcode` | `1.5.4` / `1.5.5` | Geração server-side e client-side em DataURL/SVG sem dependências externas |
| **QR Code (Leitura)** | `@yudiel/react-qr-scanner` | `2.2.1` | Leitor otimizado para dispositivos móveis e câmeras traseiras |
| **Testes Unitários** | Vitest | `2.1.8` | Execução ultrarrápida nativa com ESM e TypeScript |
| **Testes E2E** | Playwright | `1.50.1` | Automação robusta com suporte a Chromium, Firefox e WebKit |
| **Qualidade de Código** | ESLint / Prettier | `8.57.1` / `3.5.2` | Padronização de código e prevenção de vulnerabilidades |
| **Containerização** | Docker / Compose | Multi-stage slim | Imagem leve, segura (non-root `nextjs`), PostgreSQL isolado na rede interna |

---

## 2. Decisão Definitiva de Autenticação e Segurança

### 2.1 Better Auth como Autoridade Única de Sessão
- O **Better Auth** é a única autoridade de autenticação e sessão.
- **Tabelas gerenciadas**: `User`, `Session`, `Account`, `Verification`.
- **Campos de domínio no User**:
  - `role`: `PARTICIPANT` | `ATTENDANT` | `ADMIN`
  - `status`: `PENDING` | `ACTIVE` | `SUSPENDED` | `ARCHIVED`
  - `emailVerified`: `Boolean`
  - `createdAt`, `updatedAt`: `DateTime`
- **Email OTP Plugin**:
  - Código numérico de 6 dígitos.
  - Validade estrita de 5 minutos.
  - Máximo de 3 tentativas por código.
  - Rotação imediata a cada nova solicitação.
  - Armazenamento hashed (`storeOTP: "hashed"`).
  - Respostas públicas genéricas para evitar enumeração de contas.

### 2.2 Cadastro Exclusivamente Invite-Only (Bloqueio Total de Sign-up Público)
- O Better Auth é configurado de forma fechada: chamadas diretas de cadastro para e-mails não convidados são terminadas com erro `403 Forbidden`.
- **Máquina de estados para ativação de convite**:
  1. O participante acessa `/convite/[token]`.
  2. Validação do HMAC do token e do status (`AVAILABLE` ou `SENT`).
  3. Preenchimento de nome e e-mail.
  4. Criação de registro `PendingRegistration` vinculado ao convite (`PENDING_OTP`).
  5. Envio de OTP para o e-mail informado.
  6. Validação do OTP via Better Auth / Verification.
  7. Criação do usuário inicialmente como `PENDING`.
  8. **Transação Atômica de Domínio**:
     - `SELECT ... FOR UPDATE` no convite e na capacidade do programa;
     - Garantir que `(convites utilizáveis + convites utilizados) <= capacity`;
     - Vinculação do `userId` ao convite;
     - Criação do `Passport` único com número amigável (ex: `JRC-2026-XXXX`);
     - Transição do convite para `USED`;
     - Transição do usuário para `ACTIVE`;
     - Criação de entrada de auditoria `INVITATION_ACTIVATED`.
  9. Inicialização da sessão Better Auth e redirecionamento para `/passaporte`.
  10. Se a transação falhar, o usuário permanece `PENDING`, o convite permanece `AVAILABLE`/`SENT`, e o participante pode repetir a ativação idempotente sem consumir convite adicional.

### 2.3 Criptografia e Armazenamento de Tokens
- **Segredos Isolados**:
  - `BETTER_AUTH_SECRET`: Assinatura de cookies e sessões.
  - `INVITATION_TOKEN_SECRET`: HMAC-SHA-256 para tokens de convite.
  - `QR_TOKEN_SECRET`: HMAC-SHA-256 para tokens de desafios QR Code.
  - `RATE_LIMIT_SECRET`: HMAC para derivação de chaves de rate limit (IP/Email).
- **QR Code Temporário**:
  - Token aleatório de 256 bits (`crypto.randomBytes(32).toString('hex')`).
  - No banco armazena-se apenas o hash HMAC-SHA-256.
  - Expiração de 5 minutos.
  - Ao gerar novo QR, qualquer QR anterior ativo do passaporte é marcado como `REVOKED`.
  - O conteúdo do QR Code contém **exclusivamente o token opaco** (sem dados pessoais, ids sequenciais ou evento).

---

## 3. Modelo de Dados PostgreSQL / Prisma

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserRole {
  PARTICIPANT
  ATTENDANT
  ADMIN
}

enum UserStatus {
  PENDING
  ACTIVE
  SUSPENDED
  ARCHIVED
}

enum ProgramStatus {
  DRAFT
  ACTIVE
  ENDED
  CANCELLED
}

enum InvitationStatus {
  AVAILABLE
  SENT
  USED
  REVOKED
  EXPIRED
}

enum RegistrationStatus {
  PENDING_OTP
  OTP_VERIFIED
  COMPLETED
  EXPIRED
  CANCELLED
}

enum PassportStatus {
  ACTIVE
  SUSPENDED
  ARCHIVED
}

enum EventStatus {
  DRAFT
  ACTIVE
  ENDED
  CANCELLED
}

enum StampStatus {
  CONFIRMED
  CANCELLED
}

enum QrChallengeStatus {
  ACTIVE
  USED
  EXPIRED
  REVOKED
}

// Better Auth Base + Domain Fields
model User {
  id            String       @id @default(uuid())
  email         String       @unique
  name          String
  role          UserRole     @default(PARTICIPANT)
  status        UserStatus   @default(PENDING)
  emailVerified Boolean      @default(false)
  image         String?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  sessions      Session[]
  accounts      Account[]
  passports     Passport[]
  stampsIssued  Stamp[]      @relation("AttendantStamps")
  auditLogs     AuditLog[]
  createdInvites Invitation[] @relation("CreatedInvitations")
  usedInvite    Invitation?  @relation("UsedInvitation")
  cancelledStamps Stamp[]    @relation("CancelledStamps")

  @@index([email])
  @@index([role, status])
}

model Session {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Account {
  id           String    @id @default(uuid())
  userId       String
  accountId    String
  providerId   String
  accessToken  String?
  refreshToken String?
  idToken      String?
  expiresAt    DateTime?
  password     String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([providerId, accountId])
}

model Verification {
  id         String   @id @default(uuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
}

// Entidades de Domínio
model Program {
  id          String        @id @default(uuid())
  name        String
  slug        String        @unique
  capacity    Int           @default(30)
  status      ProgramStatus @default(ACTIVE)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  invitations Invitation[]
  passports   Passport[]
  events      Event[]
  registrations PendingRegistration[]
}

model Invitation {
  id             String           @id @default(uuid())
  programId      String
  tokenHash      String           @unique
  status         InvitationStatus @default(AVAILABLE)
  claimedName    String?
  claimedEmail   String?
  usedById       String?          @unique
  createdById    String?
  sentAt         DateTime?
  usedAt         DateTime?
  revokedAt      DateTime?
  expiresAt      DateTime?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  program        Program          @relation(fields: [programId], references: [id], onDelete: Restrict)
  usedBy         User?            @relation("UsedInvitation", fields: [usedById], references: [id], onDelete: Restrict)
  createdBy      User?            @relation("CreatedInvitations", fields: [createdById], references: [id], onDelete: SetNull)
  registrations  PendingRegistration[]

  @@index([tokenHash])
  @@index([programId, status])
}

model PendingRegistration {
  id              String             @id @default(uuid())
  programId       String
  invitationId    String
  normalizedEmail String
  name            String
  status          RegistrationStatus @default(PENDING_OTP)
  expiresAt       DateTime
  completedAt     DateTime?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  program         Program            @relation(fields: [programId], references: [id], onDelete: Restrict)
  invitation      Invitation         @relation(fields: [invitationId], references: [id], onDelete: Restrict)

  @@index([normalizedEmail])
  @@index([invitationId])
}

model Passport {
  id             String         @id @default(uuid())
  programId      String
  userId         String         @unique
  passportNumber String         @unique
  status         PassportStatus @default(ACTIVE)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  archivedAt     DateTime?

  program        Program        @relation(fields: [programId], references: [id], onDelete: Restrict)
  user           User           @relation(fields: [userId], references: [id], onDelete: Restrict)
  stamps         Stamp[]
  qrChallenges   QrChallenge[]

  @@index([passportNumber])
  @@index([programId])
}

model Event {
  id          String      @id @default(uuid())
  programId   String
  name        String
  description String?
  location    String?
  startDate   DateTime
  endDate     DateTime
  status      EventStatus @default(DRAFT)
  orderIndex  Int         @default(0)
  stampIcon   String      @default("standard")
  stampColor  String      @default("#cdaa63")
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  program     Program     @relation(fields: [programId], references: [id], onDelete: Restrict)
  stamps      Stamp[]

  @@index([programId, status])
  @@index([orderIndex])
}

model Stamp {
  id                 String      @id @default(uuid())
  passportId         String
  eventId            String
  attendantId        String
  status             StampStatus @default(CONFIRMED)
  stampedAt          DateTime    @default(now())
  cancelledAt        DateTime?
  cancelledById      String?
  cancellationReason String?
  createdAt          DateTime    @default(now())

  passport           Passport    @relation(fields: [passportId], references: [id], onDelete: Restrict)
  event              Event       @relation(fields: [eventId], references: [id], onDelete: Restrict)
  attendant          User        @relation("AttendantStamps", fields: [attendantId], references: [id], onDelete: Restrict)
  cancelledBy        User?       @relation("CancelledStamps", fields: [cancelledById], references: [id], onDelete: SetNull)

  // Migration manual adiciona:
  // CREATE UNIQUE INDEX "Stamp_confirmed_passport_event_key" ON "Stamp" ("passportId", "eventId") WHERE "status" = 'CONFIRMED';
  @@index([passportId])
  @@index([eventId])
  @@index([attendantId])
}

model QrChallenge {
  id         String            @id @default(uuid())
  passportId String
  tokenHash  String            @unique
  status     QrChallengeStatus @default(ACTIVE)
  expiresAt  DateTime
  usedAt     DateTime?
  revokedAt  DateTime?
  createdAt  DateTime          @default(now())

  passport   Passport          @relation(fields: [passportId], references: [id], onDelete: Restrict)

  @@index([tokenHash])
  @@index([passportId, status])
  @@index([expiresAt])
}

model AuditLog {
  id               String   @id @default(uuid())
  actorUserId      String?
  actorRole        String?
  action           String
  entity           String
  entityId         String?
  requestId        String?
  safeMetadata     Json?
  ipHash           String?
  userAgentSummary String?
  createdAt        DateTime @default(now())

  user             User?    @relation(fields: [actorUserId], references: [id], onDelete: SetNull)

  @@index([actorUserId])
  @@index([action])
  @@index([entity, entityId])
  @@index([createdAt])
}

model RateLimitBucket {
  id         String   @id @default(uuid())
  keyHash    String   @unique
  points     Int      @default(0)
  expireAt   DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([keyHash])
  @@index([expireAt])
}
```

---

## 4. Roteiro de Execução em 8 Etapas (0 a 7)

### Etapa 0: Prova Técnica de Compatibilidade e Decisões
- Validação das dependências: `@yudiel/react-qr-scanner` com React 18, `better-auth` 1.7.2 com Prisma 6.4.1.
- Registro das decisões no repositório.

### Etapa 1: Scaffold, Banco e Migrations Iniciais
- Criação de `.gitignore` rigoroso (bloqueio de `.env`, logs, credenciais).
- Inicialização da estrutura Next.js 14, TypeScript estrito, Tailwind com tokens CSS JRC.
- Configuração do Prisma 6, schema com enums e tabelas.
- Criação da migration inicial contendo o índice parcial exclusivo:
  `CREATE UNIQUE INDEX "Stamp_confirmed_passport_event_key" ON "Stamp" ("passportId", "eventId") WHERE "status" = 'CONFIRMED';`
- Criação do primeiro commit baseline na branch `main`.
- Criação da branch de trabalho `feat/passaporte-v1`.

### Etapa 2: Autenticação Better Auth, Convites Invite-Only e Rate Limit
- Configuração do Better Auth com adaptador Prisma e plugin Email OTP hashed.
- Bloqueio completo de auto-cadastro por rotas públicas.
- Implementação da máquina de estados do convite e `PendingRegistration`.
- Transação Serializable/locking para ativação de convite e respeito à capacidade de 30 pessoas.
- Implementação de `RateLimitBucket` no PostgreSQL para requisições sensíveis (OTP, Login, QR).
- Script seguro de bootstrap para o primeiro administrador (`npm run bootstrap:admin`).

### Etapa 3: Passaporte Digital e QR Code Temporário
- Tela `/passaporte` mobile-first com identidade JRC.
- Endpoint seguro `/api/qr/challenge`:
  - Validação estrita de sessão `PARTICIPANT`.
  - Invalidação de QR ativo anterior.
  - Geração de token criptográfico aleatório com hash HMAC-SHA-256 e expiração de 5 minutos.
  - Exibição em modal com contagem regressiva.
  - Sem exposição de dados pessoais no QR.

### Etapa 4: Área do Atendente e Registro de Carimbos
- Tela `/atendimento` mobile-first protegida para `ATTENDANT` e `ADMIN`.
- Seletor de evento `ACTIVE` e scanner via câmera com `@yudiel/react-qr-scanner`.
- Resumo de conferência antes da confirmação.
- Endpoint de carimbo com transação atômica no PostgreSQL:
  - Marcação de QR como `USED`.
  - Inserção de `Stamp` com status `CONFIRMED`.
  - Proteção contra concorrência e idempotência no duplo clique.
  - Registro sanitizado de auditoria.

### Etapa 5: Painel Administrativo, Ranking, Auditoria e Contingência
- Telas em `/admin`:
  - Dashboard com métricas de capacidade (30 participantes), convites e adesão.
  - Gestão de Convites: geração do lote inicial de 30, cópia de link, revogação, substituição.
  - Gestão de Eventos: CRUD, ativação, encerramento e configuração visual do carimbo.
  - Ranking de assiduidade ordenado por regras de negócio.
  - Gestão de Carimbos e cancelamento justificado com preservação de histórico.
  - Contingência: aplicação manual de carimbo restrita a `ADMIN` com identificação `MANUAL_ADMIN`.
  - Auditoria completa com utilitário de redação de dados sensíveis.
  - Exportação CSV com sanitização estrita contra formula injection.

### Etapa 6: Frontend Premium, Acessibilidade e Assets Desacoplados
- Aplicação completa dos tokens CSS JRC (`--background`, `--surface`, `--primary`, `--premium`, etc.).
- SVGs e mockups provisórios desacoplados em `/public/brand/`.
- Micro-animações de carimbo e feedback tátil/visual.
- Acessibilidade WCAG, contraste adequado, suporte a teclado e `prefers-reduced-motion`.

### Etapa 7: Infraestrutura, Docker, Dokploy, CI e Testes
- Dockerfile multi-stage Debian slim (Node 24, non-root `nextjs`).
- `docker-compose.yml` de produção (PostgreSQL isolado na rede interna, health checks).
- `docker-compose.test.yml` para execução de testes em banco isolado.
- Endpoints de health check: `/api/health/live` e `/api/health/ready`.
- Scripts de backup e restore com validação real pós-restauração.
- Suíte completa de testes: Unitários (Vitest), Integração com PostgreSQL real, E2E (Playwright).
- Documentação completa em `docs/` e `README.md`.
- Envio da branch `feat/passaporte-v1` para o repositório remoto sem merge para `main`.
