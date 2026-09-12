import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.info('[Seed] Starting database foundation seed...');

  try {
    // Verify database connectivity and basic query execution
    await prisma.$queryRaw`SELECT 1`;
    console.info('[Seed] Database connectivity verified successfully.');
    console.info(
      '[Seed] Phase 1D baseline: 0 domain entities (deferred to subsequent domain phases).',
    );
  } catch (error) {
    console.error('[Seed] Database connectivity check failed during seed.');
    throw error;
  } finally {
    await prisma.$disconnect();
    console.info('[Seed] Disconnected cleanly from database.');
  }
}

main().catch((error) => {
  console.error(
    '[Seed] Fatal error in database seed:',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
