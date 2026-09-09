import { execSync } from "child_process";
import fs from "fs";
import path from "path";

async function runRestore() {
  const backupFileArg = process.argv[2];
  let targetFile = backupFileArg;

  if (!targetFile) {
    // Pega o backup mais recente
    const backupDir = path.resolve("./backups");
    if (!fs.existsSync(backupDir)) {
      console.error("Diretório de backups não existe.");
      process.exit(1);
    }
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.error("Nenhum arquivo de backup encontrado.");
      process.exit(1);
    }
    targetFile = path.join(backupDir, files[0]);
  }

  console.log(`[Restore] Restaurando arquivo: ${targetFile}`);

  try {
    // Executa restore no banco de teste isolado
    execSync(
      `docker exec -i jrc-passaporte-postgres-test psql -U jrc_test_user -d jrc_passaporte_test < "${targetFile}"`
    );
    console.log("[Restore] Restauração concluída com sucesso no banco de teste!");
  } catch (err: unknown) {
    console.error("[Restore] Falha na restauração:", err);
    process.exit(1);
  }
}

runRestore();
