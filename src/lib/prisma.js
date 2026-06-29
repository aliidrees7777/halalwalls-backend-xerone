/**
 * Prisma client singleton.
 *
 * A single PrismaClient is shared across the whole process (creating one per
 * request would exhaust the Supabase connection pool). In dev, nodemon reloads
 * the module tree on every save, so we stash the instance on globalThis to avoid
 * leaking a new client + pool on each reload.
 */
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__halalwallsPrisma ||
  new PrismaClient({
    log: process.env.PRISMA_LOG === 'query' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__halalwallsPrisma = prisma;
}

module.exports = prisma;
