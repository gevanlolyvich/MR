import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[db:check] DATABASE_URL belum diatur di backend/.env");
    process.exit(1);
  }

  const versionRows = (await prisma.$queryRawUnsafe("SELECT VERSION() AS version")) as {
    version: string;
  }[];
  const users = await prisma.user.count();
  const branches = await prisma.branch.count();
  const risks = await prisma.risk.count();

  console.log(`[db:check] Koneksi OK - MySQL/MariaDB ${versionRows[0]?.version ?? "unknown"}`);
  console.log(`[db:check] users=${users}, branches=${branches}, risks=${risks}`);
}

main()
  .catch((err: NodeJS.ErrnoException) => {
    console.error(`[db:check] GAGAL koneksi ke database: ${err.message} (code=${err.code ?? "?"})`);
    console.error("[db:check] Pastikan MySQL/MariaDB (XAMPP) berjalan dan DATABASE_URL benar.");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
