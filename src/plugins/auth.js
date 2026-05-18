'use strict';
const fp = require('fastify-plugin');
const config = require('../config');

async function authPlugin(fastify) {
  // JWT
  await fastify.register(require('@fastify/jwt'), {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRY },
  });

  // Google OAuth2
  await fastify.register(require('@fastify/oauth2'), {
    name: 'googleOAuth2',
    scope: ['profile', 'email'],
    credentials: {
      client: { id: config.GOOGLE_CLIENT_ID, secret: config.GOOGLE_CLIENT_SECRET },
      auth: require('@fastify/oauth2').GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/api/auth/google',
    callbackUri: config.GOOGLE_CALLBACK_URL,
  });

  // Decorator: authenticate (JWT required)
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
      // Verificar que el usuario aún exista y esté activo
      const user = await fastify.db.user.findUnique({
        where: { id: request.user.id },
        select: { id: true, isAdmin: true, isActive: true },
      });
      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'Usuario no autorizado' });
      }
      request.user = { ...request.user, isAdmin: user.isAdmin };
    } catch {
      reply.status(401).send({ error: 'Token inválido o expirado' });
    }
  });

  // Decorator: adminOnly
  fastify.decorate('adminOnly', async function (request, reply) {
    await fastify.authenticate(request, reply);
    if (!request.user?.isAdmin) {
      reply.status(403).send({ error: 'Acceso restringido a administradores' });
    }
  });
}

module.exports = fp(authPlugin, { name: 'auth' });
