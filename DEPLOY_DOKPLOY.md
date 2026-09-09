# Guia de Deploy no Dokploy com PostgreSQL e Cloudflare

Este guia orienta o deploy em produção do **Passaporte de Eventos JRC** em um servidor VPS utilizando **Dokploy** (ou Docker Compose direto), com banco de dados **PostgreSQL** dedicado e apontamento de domínio via **Cloudflare**.

---

## 1. Pré-Requisitos

- Servidor VPS com **Dokploy** instalado (ou Docker + Docker Compose).
- Domínio configurado na **Cloudflare** (ex: `jrcconstrutora.com.br` ou subdomínio `passaporte.jrcconstrutora.com.br`).
- Acesso ao repositório Git do projeto.

---

## 2. Configuração do Domínio no Cloudflare

1. No painel do **Cloudflare**, vá em **DNS > Records**.
2. Adicione uma entrada do tipo **A**:
   - **Type**: `A`
   - **Name**: `passaporte` (ou `@` para o domínio raiz)
   - **IPv4 address**: `IP_DO_SEU_SERVIDOR_VPS`
   - **Proxy status**: **Proxied** (Nuvem Laranja ☁️ ativada para proteção DDoS e CDN)
   - **TTL**: Auto
3. Em **SSL/TLS > Overview**:
   - Modo de Criptografia: Selecione **Full** ou **Full (Strict)**.
4. Em **SSL/TLS > Edge Certificates**:
   - Ative **Always Use HTTPS** (redireciona HTTP para HTTPS automaticamente).
   - Ative **Minimum TLS Version**: `1.2`.
5. Em **Network**:
   - Ative **WebSockets** (necessário para Turbopack e conexões reativas do Next.js).

---

## 3. Criando o Projeto no Dokploy (Método Docker Compose — Recomendado)

O projeto já possui um `docker-compose.yml` e `Dockerfile` otimizados para produção.

### Passo 3.1: Criar um Projeto Compose
1. No painel do **Dokploy**, clique em **Create Project** (ex: `Passaporte JRC`).
2. Dentro do projeto, clique em **Add Service > Compose**.
3. Escolha a fonte:
   - **Git Repository**: Conecte ao seu repositório GitHub/GitLab (ramo `main`).
   - Ou cole o conteúdo do `docker-compose.yml` se preferir modo inline.

### Passo 3.2: Configurar as Variáveis de Ambiente (.env)
Na aba **Environment** do serviço no Dokploy, adicione as seguintes variáveis:

```ini
# ==============================================================================
# PRODUÇÃO - PASSAPORTE JRC
# ==============================================================================

# URL Pública com HTTPS (Mesmo domínio configurado no Cloudflare)
APP_URL=https://passaporte.jrcconstrutora.com.br
BETTER_AUTH_URL=https://passaporte.jrcconstrutora.com.br

# Modo de Execução
NODE_ENV=production
APP_TIMEZONE=America/Sao_Paulo

# Credenciais do PostgreSQL Interno (gerar senhas seguras)
POSTGRES_USER=jrc_prod_user
POSTGRES_PASSWORD=gere_uma_senha_forte_aqui_com_letras_e_numeros
POSTGRES_DB=jrc_passaporte_prod

# String de Conexão interna para a aplicação (usa o hostname do service postgres)
DATABASE_URL=postgresql://jrc_prod_user:gere_uma_senha_forte_aqui_com_letras_e_numeros@postgres:5432/jrc_passaporte_prod?schema=public

# Chaves Criptográficas Seguras (gerar strings aleatórias de 32 a 64 caracteres hexadecimais)
BETTER_AUTH_SECRET=a8f9c7e2b1d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6
INVITATION_TOKEN_SECRET=b7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6
QR_TOKEN_SECRET=c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2
RATE_LIMIT_SECRET=d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5

# Provedor SMTP para Envio Real de E-mails (Ex: Resend, SendGrid, Mailgun, Outlook ou Gmail)
# Se não preenchido, os convites funcionam normalmente gerando o link direto para WhatsApp!
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=re_sua_chave_api_aqui
SMTP_FROM=Passaporte Bar JRC <eventos@jrcconstrutora.com.br>
```

> **Dica para gerar os segredos criptográficos no terminal:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## 4. Configurar Domínio e Roteamento no Dokploy

1. Na aba **Domains** do serviço `app` no Dokploy:
   - **Domain**: `passaporte.jrcconstrutora.com.br`
   - **Port**: `3000`
   - **Certificate**: Se o Cloudflare estiver com proxy ativado (nuvem laranja), você pode usar o certificado gerenciado pelo Traefik/Let's Encrypt do Dokploy ou Cloudflare Origin CA.
2. Clique em **Save** e **Deploy**.

---

## 5. Executar Migrações e Seed Inicial dos Eventos

O container da aplicação já foi configurado para executar `npx prisma migrate deploy` automaticamente a cada inicialização.

Para criar os **12 eventos mensais do Bar JRC** e o primeiro usuário administrador no banco de produção:

1. No Dokploy, acesse a aba **Terminal** do container `jrc-passaporte-app` (ou via SSH no servidor):
   ```bash
   docker exec -it jrc-passaporte-app npm run seed
   ```
2. Isso criará:
   - Os 12 encontros mensais do Bar JRC (Janeiro a Dezembro de 2026).
   - O usuário administrador mestre: `admin@jrc.com.br`.
   - O atendente padrão para a recepção: `atendente@jrc.com.br`.
3. Para definir uma senha própria e segura para o administrador via linha de comando:
   ```bash
   docker exec -it jrc-passaporte-app npm run bootstrap:admin
   ```

---

## 6. Fluxo de Atualização Contínua (CI/CD)

Sempre que você fizer alterações no código e enviar para a branch principal do Git:
1. O Dokploy detecta o novo commit via Webhook.
2. Reconstrói a imagem Docker em multi-stage cacheada.
3. Executa as migrações do PostgreSQL sem downtime.
4. Reinicia a aplicação de forma transparente.
