# Arquitetura — Passaporte de Eventos JRC

## 1. Visão Geral

O **Passaporte de Eventos JRC** é uma aplicação web mobile-first desenhada para gerenciar a jornada de participação de 30 convidados selecionados em um ciclo de eventos corporativos exclusivos.

O sistema opera com três papéis fundamentais:
- **PARTICIPANT**: Usuários convidados que visualizam sua trilha de eventos, status de carimbos e exibem seu QR Code dinâmico.
- **ATTENDANT**: Recepcionistas de estande/sala que realizam a leitura de QR Codes dos participantes e registram carimbos presenciais.
- **ADMIN**: Gestão de marketing com controle de convites, eventos, auditoria, cancelamentos justificados e exportações seguras.

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Runtime & Framework** | Next.js 16 (App Router) + React 18 | SSR para rotas protegidas, layouts modulares, performance e SEO interno. |
| **Linguagem** | TypeScript 5 (Strict Mode) | Tipagem estrita de contratos de domínio, DTOs e entidades Prisma. |
| **Estilização** | Tailwind CSS v4 + Design Tokens JRC | Tema visual corporativo centralizado (jrc-navy, jrc-orange, jrc-sand, etc.). |
| **Banco de Dados** | PostgreSQL 16 | ACID rigoroso, concorrência segura, índices parciais e advisory locks. |
| **ORM & Migrações** | Prisma ORM 6.4.1 | Modelagem tipada, migrations declarativas e client transacional. |
| **Autenticação** | Better Auth 1.7.2 + Passwordless Email OTP | Zero senhas armazenadas, OTPs efêmeros com hash SHA-256 e expiração de 5 min. |
| **Scanner QR** | `@yudiel/react-qr-scanner` | Acesso nativo à câmera em navegadores mobile com fallback manual de digitação. |
| **Testes** | Vitest + Playwright | Testes unitários puros, testes de integração em PostgreSQL real e E2E. |
| **Containerização** | Docker (Node 24 Alpine/Debian slim) | Imagem multi-stage standalone otimizada para Dokploy / VPS. |

---

## 3. Topologia e Isolamento de Serviços

```
                        [ Cliente / Mobile / Desktop ]
                                      │ (HTTPS)
                                      ▼
                        [ Traefik / Dokploy Ingress ]
                                      │
                                      ▼
                      [ Next.js 16 Standalone App ]
                        ├── Public Routes (/login, /convite/[token])
                        ├── Participant Area (/passaporte)
                        ├── Attendant Area (/atendimento)
                        └── Admin Portal (/admin/*)
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
      [ PostgreSQL 16 (Database) ]              [ SMTP Provider (Mailgun) ]
        - App Tables                              - Transmissão de OTP
        - RateLimitBucket (No Redis)
        - Partial Unique Indexes
```

---

## 4. Fronteiras de Segurança e Decisões de Arquitetura

### 4.1. Cadastro Estritamente por Convite (Invite-Only)
- Não existe formulário de auto-cadastro público (`sign-up` livre desabilitado).
- O acesso inicia-se via token de convite único (`/convite/[token]`).
- O sistema valida a assinatura HMAC-SHA-256 do token e a cota do programa (limite de 30 participantes com `pg_advisory_xact_lock`).
- Ao confirmar o e-mail, é emitido um OTP de 6 dígitos. Após validação do OTP, o usuário e passaporte são criados atomicamente dentro de uma transação Prisma.

### 4.2. QR Code Challenge Efêmero
- O QR Code apresentado no passaporte do participante **não contém o ID direto do usuário ou passaporte**.
- Contém um token opaco (`challengeToken`), assinado via HMAC, com expiração estrita de **5 minutos**.
- Qualquer leitura fora da janela ou tentativa de reutilização resulta em rejeição imediata.

### 4.3. Idempotência e Prevenção de Carimbos Duplos
- A tabela `Stamp` possui um índice parcial exclusivo no PostgreSQL:
  ```sql
  CREATE UNIQUE INDEX "Stamp_confirmed_passport_event_key" 
  ON "Stamp"("passportId", "eventId") 
  WHERE "status" = 'CONFIRMED';
  ```
- Duas leituras simultâneas ou reenvios de pacotes de rede são repelidos pelo próprio motor de banco de dados, retornando status `DUPLICATE` amigável sem corrupção de estado.

### 4.4. Rate Limiting sem Dependência de Redis
- O controle de taxa é implementado na tabela `RateLimitBucket` no PostgreSQL, usando chave com hash HMAC (`ip:identifier:action`) e janela deslizante em SQL.
- Minimiza custos de infraestrutura e complexidade operacional mantendo proteção contra brute force de OTP e tokens.
