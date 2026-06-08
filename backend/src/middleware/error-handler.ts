import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

/**
 * Custom error class so services/controllers can throw typed errors
 * with HTTP status codes attached.
 *
 * @example
 *   throw new AppError("Bot no encontrado", 404);
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Catch-all error handler. Should be registered LAST (after all routes).
 * Returns a consistent JSON shape: { error: string, details?: any, stack?: string }
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  // Log full error server-side for debugging
  console.error("[ERROR]", err);

  // Zod validation error
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Datos invalidos",
      details: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (err.code === "P2002") {
      const target = (err.meta?.target as string[]) ?? [];
      return res.status(409).json({
        error: "Recurso duplicado",
        details: `Ya existe un registro con ese ${target.join(", ") || "valor"}`,
      });
    }
    // Record not found
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Recurso no encontrado" });
    }
    // Foreign key constraint failed
    if (err.code === "P2003") {
      return res.status(400).json({
        error: "Referencia invalida",
        details: "El registro relacionado no existe",
      });
    }
    return res.status(400).json({
      error: "Error de base de datos",
      code: err.code,
    });
  }

  // Custom AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Generic Error
  if (err instanceof Error) {
    const isProd = process.env.NODE_ENV === "production";
    return res.status(500).json({
      error: isProd ? "Error interno del servidor" : err.message,
      ...(isProd ? {} : { stack: err.stack }),
    });
  }

  // Unknown (non-Error) throw
  return res.status(500).json({ error: "Error desconocido" });
}

/**
 * Wrap async route handlers to forward rejected promises to error middleware.
 * Express 4 doesn't await async handlers by default, this fixes that.
 *
 * @example
 *   router.get("/foo", asyncHandler(async (req, res) => {
 *     const data = await someAsyncOp();
 *     res.json(data);
 *   }));
 */
export function asyncHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends (req: Request, res: Response, next: NextFunction) => Promise<any>
>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler for unmatched routes. Register after all routes but before
 * the error handler.
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: "Ruta no encontrada",
    path: req.originalUrl,
  });
}
