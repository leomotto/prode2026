'use strict';

async function helpRoutes(fastify) {
  // POST /api/help — crear nueva solicitud
  fastify.post('/', {
    preHandler: fastify.authenticate,
    schema: {
      body: {
        type: 'object',
        required: ['subject', 'message'],
        properties: {
          subject: { type: 'string', minLength: 3, maxLength: 100 },
          message: { type: 'string', minLength: 10, maxLength: 1000 },
        },
      },
    },
  }, async (request, reply) => {
    const { subject, message } = request.body;
    const req = await fastify.db.helpRequest.create({
      data: {
        userId: request.user.id,
        subject: subject.trim(),
        message: message.trim(),
      },
    });
    return reply.status(201).send(req);
  });

  // GET /api/help/admin — listar solicitudes (admin)
  fastify.get('/admin', { preHandler: fastify.authenticate }, async (request, reply) => {
    if (!request.user.isAdmin) return reply.status(403).send({ error: 'Sin acceso' });
    const requests = await fastify.db.helpRequest.findMany({
      include: { user: { select: { id: true, displayName: true, email: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return requests;
  });

  // PUT /api/help/admin/:id — actualizar estado (admin)
  fastify.put('/admin/:id', {
    preHandler: fastify.authenticate,
    schema: {
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['OPEN', 'RESOLVED'] },
          adminNote: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    if (!request.user.isAdmin) return reply.status(403).send({ error: 'Sin acceso' });
    const { id } = request.params;
    const { status, adminNote } = request.body;
    
    const req = await fastify.db.helpRequest.update({
      where: { id },
      data: { status, adminNote: adminNote?.trim() },
    });
    return req;
  });
}

module.exports = helpRoutes;
