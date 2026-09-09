# Engenharia de Banco de Dados — Passaporte de Eventos JRC

## 1. Visão Geral

O banco de dados do sistema utiliza **PostgreSQL 16**, orquestrado via **Prisma ORM 6.4.1**.
Foi desenhado para garantir integridade referencial estrita, auditoria imutável e proteção contra concorrência em ambiente multi-atendente.

---

## 2. Diagrama Entidade-Relacionamento (Conceitual)

```
[ Program ] 1 ──── * [ Event ] 1 ──── * [ Stamp ]
     │                                     │
     │ 1                                   │ *
     ▼                                     ▼
[ Invitation ]                        [ Passport ] 1 ──── 1 [ User ]
     │                                                           │
     │ 1                                                         │ 1
     ▼                                                           ▼
[ PendingRegistration ]                                   [ QrChallenge ]
```

---

## 3. Principais Modelos e Tabelas

| Modelo | Finalidade | Regras Críticas |
|---|---|---|
| `Program` | Ciclo do passaporte (ex: JRC 2026). Define `capacityLimit` (30). | Singleton ou escopo por edição. |
| `User` | Usuário autenticado (Better Auth compatível). | `role` in (`PARTICIPANT`, `ATTENDANT`, `ADMIN`). |
| `Passport` | Passaporte virtual de 1 participante. | Relacionamento 1:1 único com `User`. |
| `Invitation` | Convite individual com token assinado e status (`PENDING`, `USED`, `EXPIRED`, `REVOKED`). | Hash HMAC do token indexado para busca segura O(1). |
| `PendingRegistration` | Registro temporário durante o fluxo de OTP de convite. | Expiração automática e limpeza após confirmação. |
| `Event` | Eventos do passaporte (`title`, `location`, `startsAt`, `endsAt`, `points`). | Constraint SQL: `endsAt >= startsAt`. |
| `Stamp` | Registro de presença/carimbo em um evento. | Status (`CONFIRMED`, `CANCELLED`). Contém justificativa se cancelado. |
| `QrChallenge` | Desafio de validação efêmero (5 min). | Status (`PENDING`, `CONSUMED`, `EXPIRED`). |
| `AuditLog` | Trilha de auditoria append-only para compliance e segurança. | Apenas `INSERT`; campos confidenciais são sanitizados/redigidos. |
| `RateLimitBucket` | Janela deslizante de limitação de requisições. | Indexado por hash de `key` e `resetAt`. |

---

## 4. Concorrência e Índices Parciais Críticos

### 4.1. Prevenção de Carimbo Duplo (PostgreSQL Partial Unique Index)
Em eventos movimentados, atendentes podem disparar leituras quase simultâneas. Para impedir dois carimbos confirmados para o mesmo evento e participante:
```sql
CREATE UNIQUE INDEX "Stamp_confirmed_passport_event_key" 
ON "Stamp"("passportId", "eventId") 
WHERE "status" = 'CONFIRMED';
```
*Se um carimbo for cancelado administrativamente (`status = 'CANCELLED'`), o índice parcial permite que um novo carimbo válido seja emitido se necessário.*

### 4.2. Bloqueio de Capacidade Transacional (`pg_advisory_xact_lock`)
Na ativação de convites para o limite de 30 vagas, a validação de cota é protegida contra race conditions através de advisory lock transacional amarrado ao ID do `Program`:
```typescript
await tx.$executeRaw`SELECT pg_advisory_xact_lock(${programIdHash})`;
```
Garante serialização estrita mesmo com 100 requisições concorrentes.

---

## 5. Estratégia de Migrações
- Migrações são versionadas em `prisma/migrations/`.
- Aplicação em produção via:
  ```bash
  npx prisma migrate deploy
  ```
- Nunca utilizar `prisma db push` em ambientes de homologação ou produção.
