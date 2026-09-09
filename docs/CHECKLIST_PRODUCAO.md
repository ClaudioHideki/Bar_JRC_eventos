# Checklist de Produção (Go-Live) — Passaporte de Eventos JRC

Passo a passo mandatório para publicação e liberação oficial no ambiente de produção.

---

## 1. Segurança e Configurações de Ambiente
- [ ] Domínio com certificado SSL/TLS (HTTPS) ativo via Traefik/Let's Encrypt.
- [ ] Variável `NODE_ENV=production` definida no Dokploy.
- [ ] Variável `NEXT_PUBLIC_APP_URL` apontando para o domínio canônico HTTPS sem barra final.
- [ ] Chaves de segredo geradas com alta entropia (32 bytes aleatórios):
  - `BETTER_AUTH_SECRET`
  - `INVITATION_TOKEN_SECRET`
  - `QR_TOKEN_SECRET`
  - `RATE_LIMIT_SECRET`
- [ ] Verificado que nenhum arquivo `.env` foi commitado no Git.

## 2. Banco de Dados e Migrações
- [ ] Instância PostgreSQL 16 de produção com senha forte e acesso restrito à rede interna do Docker.
- [ ] Executada a migração oficial: `npx prisma migrate deploy`.
- [ ] Executado o bootstrap do primeiro administrador:
  ```bash
  ADMIN_EMAIL="admin.oficial@jrc.com.br" ADMIN_NAME="Coordenação JRC" npm run admin:bootstrap
  ```
- [ ] Executada a carga inicial de eventos e 30 convites: `npm run seed`.
- [ ] Agendamento de backup periódico (cron de 6 horas) configurado no servidor.
- [ ] Teste de backup manual executado com sucesso: `npm run db:backup`.

## 3. Serviços de Mensageria (SMTP)
- [ ] Credenciais SMTP configuradas no Dokploy (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`).
- [ ] SPF, DKIM e DMARC do domínio validados no provedor de e-mail (Mailgun/SendGrid) para evitar caixa de spam.
- [ ] Teste real de envio de OTP efetuado para e-mail corporativo.

## 4. Auditoria e Monitoramento
- [ ] Verificação de logs da aplicação (`docker logs -f <app_id>`) sem vazamento de tokens ou dados confidenciais.
- [ ] Rota `/api/health/live` e `/api/health/ready` integradas ao monitoramento de uptime do Dokploy.
- [ ] Links de convite gerados e distribuídos exclusivamente pelo canal oficial de assessoria/marketing aos 30 participantes selecionados.
