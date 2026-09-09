# Plano de Rollback e Recuperação — Passaporte de Eventos JRC

## 1. Visão Geral

Este documento detalha as etapas a serem tomadas caso uma implantação ou atualização em produção apresente falhas críticas.

---

## 2. Rollback de Aplicação (Container Dokploy)

Como o build no Dokploy é baseado em imagens Docker versionadas:

1. Acesse o painel da aplicação no Dokploy.
2. Na aba **Deployments / History**, localize a versão anterior que estava estável.
3. Clique em **Rollback / Redeploy** na versão anterior.
4. O Dokploy iniciará o container anterior sem necessidade de recompilação.
5. Verifique a recuperação pelo endpoint `/api/health/ready`.

---

## 3. Rollback de Migrações de Banco de Dados

Se uma nova migração do Prisma introduziu problemas de esquema:

1. Interrompa temporariamente a aplicação web:
   ```bash
   docker stop passaporte_jrc_web
   ```
2. Realize o dump de segurança imediato do estado atual antes de reverter:
   ```bash
   npm run db:backup
   ```
3. Se a migração for destrutiva ou corromper dados, restaure o dump imediatamente anterior à publicação:
   ```bash
   npm run db:restore ./backups/backup-pre-deploy.sql
   ```
4. Suba novamente o container web na versão estável anterior.

---

## 4. Contatos de Emergência da Operação

- **Líder Técnico / DevOps**: Responsável pela restauração de containers e banco.
- **Coordenação do Evento JRC**: Responsável por comunicar atendentes em campo para utilizarem a contingência manual enquanto o serviço é normalizado.
