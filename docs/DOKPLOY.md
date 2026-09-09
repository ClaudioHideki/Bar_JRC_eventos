# Guia de Deploy no Dokploy — Passaporte de Eventos JRC

## 1. Visão Geral

Este guia descreve o procedimento para deploy contínuo da aplicação no **Dokploy** (ou qualquer VPS com Docker Compose e Traefik).

---

## 2. Pré-requisitos no Servidor Dokploy

1. Instância Dokploy ativa com suporte a Docker e SSL automático (Let's Encrypt / Traefik).
2. Serviço de Banco de Dados PostgreSQL 16 provisionado (Dokploy Database ou externo).
3. Credenciais de envio de e-mail SMTP transacional (Mailgun, SendGrid ou similar).

---

## 3. Variáveis de Ambiente Obrigatórias

Configure no painel de Environment Variables da aplicação no Dokploy:

```env
# Ambiente e URLs
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://passaporte.seudominio.com.br
PORT=3000

# Conexão com Banco de Dados PostgreSQL
DATABASE_URL=postgresql://jrc_user:SENHA_COMPLEXA@postgres:5432/jrc_passaporte?schema=public

# Segredos Criptográficos (Gerar com: openssl rand -hex 32)
BETTER_AUTH_SECRET=gerar_hex_de_32_bytes_aqui
INVITATION_TOKEN_SECRET=gerar_outro_hex_de_32_bytes_aqui
QR_TOKEN_SECRET=gerar_outro_hex_de_32_bytes_aqui
RATE_LIMIT_SECRET=gerar_outro_hex_de_32_bytes_aqui

# Provedor de E-mail Transacional (SMTP)
EMAIL_FROM=no-reply@passaporte.seudominio.com.br
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@mg.seudominio.com.br
SMTP_PASS=sua_senha_smtp_aqui
```

---

## 4. Tipo de Build no Dokploy

- **Build Type**: `Dockerfile`
- **Dockerfile Path**: `./Dockerfile`
- **Context Path**: `.`
- **Port Exposed**: `3000`

---

## 5. Script de Inicialização e Migração

No Dokploy, na aba de **Lifecycle / Post-Deploy / Commands**, execute as migrações antes da subida da nova versão:
```bash
npx prisma migrate deploy
```

Para inicializar os 30 convites padrão e o usuário administrador inicial em nova instalação:
```bash
npm run seed
ADMIN_EMAIL="admin@jrc.com.br" ADMIN_NAME="Administrador JRC" npm run admin:bootstrap
```

---

## 6. Verificação de Saúde (Healthcheck)

Configure os probes no Dokploy:
- **Liveness Probe**: `GET /api/health/live` (Intervalo: 30s, Timeout: 5s, Unhealthy Threshold: 3)
- **Readiness Probe**: `GET /api/health/ready` (Verifica conectividade ativa com o PostgreSQL)
