# Procedimento de Backup e Restauração — Passaporte de Eventos JRC

## 1. Visão Geral

Este documento define os procedimentos de backup e disaster recovery do banco de dados PostgreSQL do sistema.

---

## 2. Scripts Nativos do Repositório

O projeto possui scripts TypeScript parametrizados em `scripts/backup.ts` e `scripts/restore.ts`, executáveis via `npm run`:

### 2.1. Execução de Backup Manual
Para realizar o dump consistente do banco:
```bash
npm run db:backup
```
- O arquivo é gerado em `./backups/backup-jrc_passaporte-<timestamp>.sql`.
- O dump contém definições DDL, dados de todas as tabelas e índices parciais.
- Testa a integridade do arquivo garantindo tamanho maior que 1KB e presença de marcadores PostgreSQL.

### 2.2. Execução de Restauração Manual
Para restaurar uma base a partir de um dump:
```bash
npm run db:restore ./backups/backup-jrc_passaporte-2026-09-04T20-00-00-000Z.sql
```
*Atenção: A restauração deve ser executada apenas em ambiente de manutenção com os serviços da aplicação temporariamente pausados.*

---

## 3. Agendamento Automático via Cron no Servidor (Dokploy / VPS)

Adicione a seguinte tarefa no cron do host ou container PostgreSQL para execução a cada 6 horas:

```bash
# Backup a cada 6 horas
0 */6 * * * docker exec -t postgres_container_id pg_dump -U jrc_user -d jrc_passaporte -F c -b -v -f /backups/jrc_$(date +\%Y\%m\%d_\%H\%M\%S).dump
# Retenção de 7 dias
0 2 * * * find /backups -name "jrc_*.dump" -mtime +7 -exec rm {} \;
```

---

## 4. Teste de Simulação de Desastre (Disaster Recovery)

1. Parar a aplicação: `docker compose stop web`
2. Criar um banco de teste vazio: `psql -U postgres -c "CREATE DATABASE jrc_recovery_test;"`
3. Restaurar o arquivo mais recente no banco de teste: `psql -U jrc_user -d jrc_recovery_test < ./backups/backup-mais-recente.sql`
4. Validar integridade das tabelas:
   ```sql
   SELECT count(*) FROM "User";
   SELECT count(*) FROM "Stamp";
   SELECT count(*) FROM "AuditLog";
   ```
5. Confirmar que o número de participantes e carimbos corresponde ao momento do dump.
