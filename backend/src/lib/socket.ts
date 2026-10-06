import { Server as HttpServer } from "http";
import { Server } from "socket.io";

/**
 * Owns the Socket.io server so services and controllers can emit events
 * without importing src/index.ts (which caused 6 import cycles).
 * initSocket is called once at bootstrap; getIo throws if used before that.
 */
let io: Server | null = null;

export function initSocket(server: HttpServer): Server {
  if (io) return io;
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
    },
  });
  return io;
}

export function getIo(): Server {
  if (!io) {
    throw new Error("Socket.io server not initialized: call initSocket() at bootstrap first");
  }
  return io;
}
