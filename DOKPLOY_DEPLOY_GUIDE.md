# Guia Completo de Deploy no Dokploy (Passaporte Bar JRC)

Este guia explica, passo a passo, como subir o sistema no seu servidor utilizando **Dokploy**, com banco de dados **PostgreSQL** e domínio apontado via **Cloudflare**.

---

## 📋 Sumário do Processo
1. [Apontamento de DNS no Cloudflare](#1-apontamento-de-dns-no-cloudflare)
2. [Criação do Banco PostgreSQL no Dokploy](#2-criação-do-banco-postgresql-no-dokploy)
3. [Configuração da Aplicação no Dokploy](#3-configuração-da-aplicação-no-dokploy)
4. [Variáveis de Ambiente de Produção](#4-variáveis-de-ambiente-de-produção)
5. [Configuração de Domínio e Certificado SSL](#5-configuração-de-domínio-e-certificado-ssl)
6. [Primeira Execução e Carga Inicial (Seed)](#6-primeira-execução-e-carga-inicial-seed)
7. [Deploy Alternativo via Docker Compose](#7-deploy-alternativo-via-docker-compose)

---

## 1. Apontamento de DNS no Cloudflare

Antes ou durante a configuração no Dokploy, faça o apontamento do domínio ou subdomínio para o IP público da sua VPS:

1. Acesse o painel da **Cloudflare** e selecione o seu domínio.
2. Vá em **DNS** > **Records** e clique em **Add record**.
3. Configure o apontamento:
   - **Type**: `A`
   - **Name**: `passaporte` (ou `@` se for usar o domínio raiz)
   - **IPv4 address**: Digite o **IP da sua VPS** (onde o Dokploy está instalado)
   - **Proxy status**: 
     - *Recomendação inicial:* Deixe em **DNS Only** (nuvem cinza) para o Dokploy/Traefik emitir o certificado Let's Encrypt com facilidade.
     - *Após o SSL emitido:* Você pode ativar o **Proxied** (nuvem laranja) com o SSL do Cloudflare configurado em modo **Full (strict)**.
4. Salve o registro. O domínio final será (exemplo): `passaporte.seudominio.com.br`.

---

## 2. Criação do Banco PostgreSQL no Dokploy

O Dokploy possui gerenciamento nativo de bancos de dados isolados:

1. No painel do Dokploy, acesse ou crie um **Projeto** (ex: `JRC-Passaporte`).
2. Clique em **Create Service** > selecione **Database** > **PostgreSQL**.
3. Nomeie o serviço (ex: `jrc-postgres`).
4. Nas configurações do banco:
   - **Database Name**: `jrc_passaporte`
   - **User**: `jrc_user`
   - **Password**: Defina uma senha forte (ex: `JrcForte2026!#Segura`)
5. Clique em **Deploy**.
6. Após o status ficar verde (*Running*), copie a **Internal Connection String** (conexão na rede interna do Docker), que terá o formato:
   ```text
   postgresql://jrc_user:JrcForte2026!#Segura@jrc-postgres:5432/jrc_passaporte?schema=public
   ```

---

## 3. Configuração da Aplicação no Dokploy

1. No mesmo Projeto no Dokploy, clique em **Create Service** > **Application**.
2. Nomeie a aplicação (ex: `passaporte-app`).
3. Em **Source** (Fonte):
   - Conecte o seu repositório Git (GitHub ou GitLab).
   - Selecione o repositório do projeto e a branch `main`.
4. Em **Build Settings**:
   - **Build Type**: Selecione **Dockerfile**.
   - **Dockerfile Path**: `./Dockerfile` (já otimizado em multi-stage pronto no projeto).
   - **Context**: `.`

---

## 4. Variáveis de Ambiente de Produção

Na aba **Environment** da aplicação no Dokploy, adicione as seguintes variáveis:

```env
# 1. Banco de Dados (Cole a conexão interna do PostgreSQL criado no Dokploy)
DATABASE_URL="postgresql://jrc_user:JrcForte2026!#Segura@jrc-postgres:5432/jrc_passaporte?schema=public"

# 2. URLs do Sistema (Coloque o domínio configurado no Cloudflare)
APP_URL="https://passaporte.seudominio.com.br"
BETTER_AUTH_URL="https://passaporte.seudominio.com.br"

# 3. Chaves Criptográficas de Segurança (Gere segredos aleatórios de 32 bytes)
BETTER_AUTH_SECRET="f6c8d370e5b721869e9a4f478b872b7a4c7e2b6e1a90f1d5c2e3a4b5c6d7e8f9"
INVITATION_TOKEN_SECRET="a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0"
QR_TOKEN_SECRET="9876543210fedcba0987654321fedcba0987654321fedcba0987654321fedcba"
RATE_LIMIT_SECRET="11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff"

# 4. Ambiente e Fuso Horário
NODE_ENV="production"
APP_TIMEZONE="America/Sao_Paulo"
BOOTSTRAP_ADMIN_EMAIL="admin@jrc.com.br"

# 5. Configuração de E-mail SMTP (Opcional - caso queira envio automático além do WhatsApp)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="Passaporte JRC <no-reply@jrc.com.br>"
```

> **Dica para gerar chaves seguras:** No terminal da sua máquina você pode gerar chaves aleatórias rodando:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## 5. Configuração de Domínio e Certificado SSL

1. Na aba **Domains** da sua aplicação no Dokploy:
2. Clique em **Add Domain**:
   - **Host**: `passaporte.seudominio.com.br`
   - **Path**: `/`
   - **Port**: `3000` (porta interna do Next.js)
   - **Certificate**: Selecione **Let's Encrypt** (HTTPS automático)
3. Salve e aguarde alguns instantes enquanto o Traefik do Dokploy valida o domínio e emite o certificado SSL.

---

## 6. Primeira Execução e Carga Inicial (Seed)

O Dockerfile do projeto já está configurado para executar as migrações automaticamente no boot:
```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
```

### Para popular os 12 eventos mensais e os usuários iniciais:
1. No Dokploy, vá na aba **Terminal / Console** da aplicação `passaporte-app`.
2. Execute o comando:
   ```bash
   npm run seed
   ```
3. O script criará:
   - O Programa oficial dos 40 Anos da JRC (com teto estrito de 30 vagas).
   - Os 12 encontros mensais (Janeiro a Dezembro).
   - O usuário administrador (`admin@jrc.com.br`) e o atendente (`atendente@jrc.com.br`).

---

## 7. Deploy Alternativo via Docker Compose (Stack Completa)

Se preferir subir tanto o PostgreSQL quanto a aplicação em um único Compose dentro do Dokploy:

1. No Dokploy, clique em **Create Service** > **Compose**.
2. Nomeie o serviço (ex: `jrc-stack`).
3. Cole o conteúdo de `docker-compose.yml` do projeto.
4. Na aba **Environment**, insira as mesmas variáveis listadas na Seção 4.
5. Em **Domains**, aponte para o container `app` na porta `3000`.
6. Clique em **Deploy**.

---

## 🔒 Checklist Final de Produção
- [ ] O domínio no Cloudflare aponta para o IP da VPS.
- [ ] A variável `APP_URL` e `BETTER_AUTH_URL` estão com `https://` e sem barra no final.
- [ ] O certificado SSL está ativo e respondendo com cadeado verde no navegador.
- [ ] O comando `npm run seed` foi executado para criar os eventos de Janeiro a Dezembro.
- [ ] O login de Administrador (`/admin`) e o módulo do Atendente (`/atendimento`) foram testados.
- [ ] Ao enviar convites via WhatsApp, o link gerado aponta para o domínio público oficial e é clicável pelo cliente.
