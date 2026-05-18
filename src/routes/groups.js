'use strict';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I,O,0,1 para evitar confusiones

function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

async function groupRoutes(fastify) {

  // GET /api/groups/mine — mis grupos
  fastify.get('/mine', { preHandler: fastify.authenticate }, async (request) => {
    const userId = request.user.id;
    const memberships = await fastify.db.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            owner:   { select: { id: true, displayName: true, avatar: true } },
            members: { include: { user: { select: { id: true, displayName: true, avatar: true } } } },
          }
        }
      },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map(m => ({
      ...m.group,
      memberCount: m.group.members.length,
      isOwner: m.group.ownerId === userId,
    }));
  });

  // POST /api/groups — crear grupo
  fastify.post('/', {
    preHandler: fastify.authenticate,
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name:        { type: 'string', minLength: 3, maxLength: 60 },
          description: { type: 'string', maxLength: 200 },
        },
      },
    },
  }, async (request, reply) => {
    const { name, description } = request.body;
    const userId = request.user.id;

    // Generar código único
    let code, exists = true;
    while (exists) {
      code = generateCode();
      exists = await fastify.db.group.findUnique({ where: { code } });
    }

    const group = await fastify.db.group.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        code,
        ownerId: userId,
        members: { create: { userId } }, // el creador es miembro automáticamente
      },
      include: { members: true },
    });

    return reply.status(201).send({ ...group, memberCount: 1, isOwner: true });
  });

  // POST /api/groups/join — unirse con código
  fastify.post('/join', {
    preHandler: fastify.authenticate,
    schema: {
      body: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const code = request.body.code.trim().toUpperCase();

    const group = await fastify.db.group.findUnique({
      where: { code },
      include: { members: true },
    });
    if (!group) return reply.status(404).send({ error: 'Código de grupo no encontrado' });
    if (group.members.length >= group.maxMembers)
      return reply.status(400).send({ error: 'El grupo está lleno' });

    const already = group.members.find(m => m.userId === userId);
    if (already) return reply.status(400).send({ error: 'Ya sos miembro de este grupo' });

    await fastify.db.groupMember.create({ data: { groupId: group.id, userId } });
    return { groupId: group.id, groupName: group.name, code: group.code };
  });

  // GET /api/groups/:id/ranking — ranking dentro del grupo
  fastify.get('/:id/ranking', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.id;

    // Verificar que el usuario es miembro
    const membership = await fastify.db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'No sos miembro de este grupo' });

    // Obtener todos los miembros con sus puntos
    const members = await fastify.db.groupMember.findMany({
      where: { groupId: id },
      include: { user: { select: { id: true, displayName: true, avatar: true, email: true } } },
    });

    const rankings = await Promise.all(members.map(async m => {
      const agg = await fastify.db.prediction.aggregate({
        where: { userId: m.userId, pointsTotal: { not: null } },
        _sum: { pointsTotal: true },
        _count: { _all: true },
      });
      return {
        userId:      m.user.id,
        displayName: m.user.displayName,
        avatar:      m.user.avatar,
        totalPoints: agg._sum.pointsTotal ?? 0,
        partidos:    agg._count._all,
        isOwner:     false, // se calcula abajo
        joinedAt:    m.joinedAt,
      };
    }));

    const group = await fastify.db.group.findUnique({ where: { id }, select: { ownerId: true, name: true, code: true } });
    rankings.forEach(r => { r.isOwner = r.userId === group.ownerId; });
    rankings.sort((a, b) => b.totalPoints - a.totalPoints);
    rankings.forEach((r, i) => { r.rank = i + 1; });

    return { group: { id, ...group }, ranking: rankings };
  });

  // DELETE /api/groups/:id — eliminar grupo (solo owner)
  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params;
    const group = await fastify.db.group.findUnique({ where: { id } });
    if (!group) return reply.status(404).send({ error: 'Grupo no encontrado' });
    if (group.ownerId !== request.user.id && !request.user.isAdmin)
      return reply.status(403).send({ error: 'Solo el creador puede eliminar el grupo' });
    await fastify.db.group.delete({ where: { id } });
    return { ok: true };
  });

  // DELETE /api/groups/:id/leave — salir del grupo
  fastify.delete('/:id/leave', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.id;
    const group = await fastify.db.group.findUnique({ where: { id } });
    if (!group) return reply.status(404).send({ error: 'Grupo no encontrado' });
    if (group.ownerId === userId)
      return reply.status(400).send({ error: 'El dueño no puede salir. Eliminá el grupo.' });
    await fastify.db.groupMember.deleteMany({ where: { groupId: id, userId } });
    return { ok: true };
  });
}

module.exports = groupRoutes;
