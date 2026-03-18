import type { FastifyPluginAsync } from "fastify";
import { z } from "zod/v4";
import {
  listDevices,
  getDeviceByDeviceId,
  getDeviceById,
  claimDevice,
  updateDeviceName,
  removeDevice,
  getReadingsInRange,
} from "../../services/device.js";

export const deviceRoutes: FastifyPluginAsync = async (app) => {
  // GET /devices — list user's devices
  app.get("/devices", async (request) => {
    const userId = request.user!.userId;
    return listDevices(app.db, userId);
  });

  // POST /devices — claim a device
  app.post("/devices", async (request, reply) => {
    const userId = request.user!.userId;
    const body = z.object({ device_id: z.string().min(1) }).parse(request.body);

    const existing = getDeviceByDeviceId(app.db, body.device_id);
    if (existing) {
      return reply.conflict("Device already claimed");
    }

    const device = claimDevice(app.db, userId, body.device_id);
    return reply.status(201).send(device);
  });

  // PATCH /devices/:id — rename
  app.patch("/devices/:id", async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const body = z.object({ name: z.string() }).parse(request.body);

    const device = getDeviceById(app.db, Number(id));
    if (!device) {
      return reply.notFound("Device not found");
    }
    if (device.userId !== userId) {
      return reply.forbidden("Not your device");
    }

    updateDeviceName(app.db, device.id, body.name);
    return { ...device, name: body.name };
  });

  // DELETE /devices/:id — unclaim
  app.delete("/devices/:id", async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    const device = getDeviceById(app.db, Number(id));
    if (!device) {
      return reply.notFound("Device not found");
    }
    if (device.userId !== userId) {
      return reply.forbidden("Not your device");
    }

    removeDevice(app.db, device.id);
    return reply.status(204).send();
  });

  // GET /devices/:id/history?from=&to=
  app.get("/devices/:id/history", async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const query = request.query as { from?: string; to?: string };

    const device = getDeviceById(app.db, Number(id));
    if (!device) {
      return reply.notFound("Device not found");
    }
    if (device.userId !== userId) {
      return reply.forbidden("Not your device");
    }

    const from = query.from ? Number(query.from) : 0;
    const to = query.to ? Number(query.to) : Math.floor(Date.now() / 1000);

    return getReadingsInRange(app.db, device.deviceId, from, to);
  });
};
