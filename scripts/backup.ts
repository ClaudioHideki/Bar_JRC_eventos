import { execSync } from "child_process";
import fs from "fs";
import path from "path";

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve("./backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);
  const dbUrl = process.env.DATABASE_URL || "postgresql://jrc_user:jrc_secure_password@localhost:5432/jrc_passaporte?schema=public";

  console.log(`[Backup] Iniciando backup do PostgreSQL para: ${backupFile}`);

  try {
    // Executa pg_dump via docker ou CLI
    const isDocker = fs.existsSync("/.dockerenv");
    if (isDocker) {
      execSync(`pg_dump "${dbUrl}" -F p > "${backupFile}"`);
    } else {
      // No host local, executa via container do postgres
      execSync(
        `docker exec jrc-passaporte-postgres-test pg_dump -U jrc_test_user jrc_passaporte_test > "${backupFile}"`
      );
    }

    const stats = fs.statSync(backupFile);
    if (stats.size === 0) {
      throw new Error("Arquivo de backup gerado com 0 bytes.");
    }

    console.log(`[Backup] Concluído com sucesso! Tamanho: ${stats.size} bytes.`);
    return backupFile;
  } catch (err: unknown) {
    console.error("[Backup] Falha na execução:", err);
    process.exit(1);
  }
}

runBackup();
