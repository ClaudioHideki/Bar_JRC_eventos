# AGENTS.md — Diretrizes de Manutenção para IAs e Desenvolvedores

Este documento estabelece as regras arquiteturais, de segurança e de desenvolvimento para qualquer manutenção realizada no **Passaporte de Eventos JRC**.

---

## 1. Princípios Inegociáveis

1. **Repositório Público**: NUNCA versione credenciais, tokens, senhas, chaves de API, arquivos `.env`, e-mails pessoais reais ou connection strings de banco de dados.
2. **Sem Autoria de IA nos Commits**: Os commits devem conter mensagens semânticas padronizadas (`feat:`, `fix:`, `chore:`, `test:`) e manter o autor configurado localmente.
3. **Não Utilizar Tecnologias Proibidas**:
   - É estritamente proibido incluir Supabase, Firebase, SQLite, Redis ou MinIO.
   - O rate limiting e a persistência devem ocorrer exclusivamente no PostgreSQL.
4. **Sem Dados Mockados em Produção**: Todas as regras de negócio devem ser executadas contra o banco PostgreSQL real através do Prisma ORM.
5. **Cadastro Exclusivamente Invite-Only**:
   - O Better Auth nunca deve permitir cadastro público ou por senha.
   - Qualquer cadastro sem convite válido associado deve falhar no nível mais baixo (database hook ou validação prévia).

---

## 2. Padrões de Domínio e Segurança

### 2.1 Capacidade do Programa (Teto de 30)
- A capacidade deve ser verificada via transação serializada ou com bloqueio pessimista (`SELECT ... FOR UPDATE` no `Program`).
- Fórmula obrigatória: `(convites utilizáveis + convites utilizados) <= capacidade`.
- Convites `AVAILABLE` e `SENT` contam como ocupação de vaga provisória. Convites `USED` contam como ocupação definitiva. Convites `REVOKED` ou `EXPIRED` liberam a vaga para nova emissão.

### 2.2 QR Code Temporário
- Deve conter **exclusivamente um token criptográfico opaco** (32 bytes CSPRNG em hex).
- Nunca incluir nome, e-mail, id sequencial, id de usuário ou id de evento no payload do QR.
- A validação no servidor deve comparar apenas o hash HMAC-SHA-256 (`QR_TOKEN_SECRET`).
- O QR possui expiração de 5 minutos e é de uso único. Qualquer novo QR gerado revoga os anteriores do mesmo passaporte.

### 2.3 Carimbo e Concorrência
- O modelo `Stamp` possui índice parcial exclusivo no PostgreSQL:
  ```sql
  CREATE UNIQUE INDEX "Stamp_confirmed_passport_event_key"
  ON "Stamp" ("passportId", "eventId")
  WHERE "status" = 'CONFIRMED';
  ```
- Carimbos cancelados recebem status `CANCELLED` e não são excluídos fisicamente.
- Apenas usuários com papel `ADMIN` podem cancelar carimbos (com justificativa obrigatória) ou aplicar carimbos manuais de contingência (`MANUAL_ADMIN`).

### 2.4 Prevenção de CSV Formula Injection (DDE)
- Toda exportação CSV deve passar as células pela função `sanitizeCsvCell(value)` localizada em `src/lib/security/crypto.ts`.
- Valores iniciados por `=`, `+`, `-`, `@`, `\t` ou `\r` devem ser prefixados com apóstrofo (`'`).

---

## 3. Estrutura de Testes

- **Testes Unitários** (`tests/unit/`): Vitest rápido, cobrindo criptografia, capacidade, sanitização CSV e redação de auditoria.
- **Testes de Integração com PostgreSQL Real** (`tests/integration/`): Executam contra container Docker na porta 5433, validando transações, locks, constraints exclusivas e regras de unicidade.
- **Testes E2E** (`tests/e2e/`): Playwright validando rotas, health checks e fluxos de tela.
- **Comandos de Verificação Antes de Commitar**:
  ```bash
  npm run lint
  npm run typecheck
  npm run test:unit
  npm run test:integration
  npm run build
  ```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
