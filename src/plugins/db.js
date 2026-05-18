'use strict';
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

const fp = require('fastify-plugin');

async function dbPlugin(fastify) {
  await prisma.$connect();
  fastify.decorate('db', prisma);
  fastify.addHook('onClose', async () => { await prisma.$disconnect(); });
}

module.exports = fp(dbPlugin, { name: 'db' });
