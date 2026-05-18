'use strict';
const bcrypt = require('bcrypt');
const config = require('../config');
const { verifyTurnstile } = require('../lib/turnstile');

const SALT_ROUNDS = 12;

async function authRoutes(fastify) {

  // POST /api/auth/register
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'displayName', 'password', 'turnstileToken'],
        properties: {
          email:          { type: 'string', format: 'email', maxLength: 255 },
          displayName:    { type: 'string', minLength: 2, maxLength: 50 },
          password:       { type: 'string', minLength: 8, maxLength: 128 },
          avatar:         { type: 'string', maxLength: 10 },
          turnstileToken: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { email, displayName, password, avatar, turnstileToken } = request.body;
    const ip = request.ip;

    const valid = await verifyTurnstile(turnstileToken, ip);
    if (!valid) return reply.status(400).send({ error: 'Verificación de seguridad fallida' });

    const exists = await fastify.db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) return reply.status(409).send({ error: 'El email ya está registrado' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await fastify.db.user.create({
      data: {
        email: email.toLowerCase(),
        displayName,
        passwordHash,
        avatar: avatar || '⚽',
      },
      select: { id: true, email: true, displayName: true, avatar: true, isAdmin: true },
    });

    const token = fastify.jwt.sign({ id: user.id, email: user.email, isAdmin: user.isAdmin });
    return reply.status(201).send({ user, token });
  });

  // POST /api/auth/login
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'turnstileToken'],
        properties: {
          email:          { type: 'string', format: 'email' },
          password:       { type: 'string' },
          turnstileToken: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password, turnstileToken } = request.body;
    const ip = request.ip;

    const valid = await verifyTurnstile(turnstileToken, ip);
    if (!valid) return reply.status(400).send({ error: 'Verificación de seguridad fallida' });

    const user = await fastify.db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: 'Credenciales inválidas' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return reply.status(401).send({ error: 'Credenciales inválidas' });
    if (!user.isActive) return reply.status(403).send({ error: 'Cuenta deshabilitada' });

    const token = fastify.jwt.sign({ id: user.id, email: user.email, isAdmin: user.isAdmin });
    return {
      token,
      user: { id: user.id, email: user.email, displayName: user.displayName, avatar: user.avatar, isAdmin: user.isAdmin },
    };
  });

  // GET /api/auth/me
  fastify.get('/me', { preHandler: fastify.authenticate }, async (request) => {
    const user = await fastify.db.user.findUnique({
      where: { id: request.user.id },
      select: { id: true, email: true, displayName: true, avatar: true, isAdmin: true, createdAt: true },
    });
    return user;
  });

  // GET /api/auth/google (redirect) — manejado por @fastify/oauth2
  // GET /api/auth/google/callback
  fastify.get('/google/callback', async (request, reply) => {
    const { token: googleToken } = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${googleToken.access_token}` },
    });
    const profile = await res.json();

    if (!profile.email) return reply.status(400).send({ error: 'No se pudo obtener el email de Google' });

    let user = await fastify.db.user.findFirst({
      where: { OR: [{ googleId: profile.id }, { email: profile.email.toLowerCase() }] },
    });

    if (!user) {
      user = await fastify.db.user.create({
        data: {
          email: profile.email.toLowerCase(),
          displayName: profile.name || profile.email,
          googleId: profile.id,
          avatar: '🌐',
        },
      });
    } else if (!user.googleId) {
      user = await fastify.db.user.update({
        where: { id: user.id },
        data: { googleId: profile.id },
      });
    }

    if (!user.isActive) return reply.status(403).send({ error: 'Cuenta deshabilitada' });

    const jwtToken = fastify.jwt.sign({ id: user.id, email: user.email, isAdmin: user.isAdmin });
    // Redirigir al dashboard con token en query param (el JS lo guarda en localStorage)
    return reply.redirect(`${config.APP_URL}/?token=${jwtToken}`);
  });

  // POST /api/auth/setup-admin (solo con ADMIN_SETUP_KEY, una sola vez)
  fastify.post('/setup-admin', async (request, reply) => {
    const { email, key } = request.body || {};
    if (!config.ADMIN_SETUP_KEY || key !== config.ADMIN_SETUP_KEY) {
      return reply.status(403).send({ error: 'Clave inválida' });
    }
    const user = await fastify.db.user.update({
      where: { email: email.toLowerCase() },
      data: { isAdmin: true },
      select: { id: true, email: true, displayName: true, isAdmin: true },
    });
    return user;
  });

  // PUT /api/auth/me — actualizar perfil
  fastify.put('/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { displayName, avatar, password } = request.body || {};
    const updates = {};
    if (displayName && displayName.trim().length >= 2) updates.displayName = displayName.trim().substring(0, 50);
    if (avatar) updates.avatar = avatar.substring(0, 10);
    if (password) {
      if (password.length < 8) return reply.status(400).send({ error: 'La contraseña debe tener al menos 8 caracteres' });
      updates.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }
    if (!Object.keys(updates).length) return reply.status(400).send({ error: 'Nada que actualizar' });
    const user = await fastify.db.user.update({
      where: { id: request.user.id },
      data: updates,
      select: { id: true, email: true, displayName: true, avatar: true, isAdmin: true },
    });
    return user;
  });

  // POST /api/auth/logout
  fastify.post('/logout', { preHandler: fastify.authenticate }, async (request, reply) => {
    return reply.send({ ok: true });
  });
}

module.exports = authRoutes;

