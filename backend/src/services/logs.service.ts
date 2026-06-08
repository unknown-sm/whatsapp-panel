import prisma from "../lib/prisma";

export type LogLevel = "debug" | "info" | "warn" | "error";

export async function writeLog(
  level: LogLevel,
  source: string,
  action: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  try {
    await prisma.crmLog.create({
      data: { level, source, action, message, meta: meta ? (meta as any) : undefined },
    });
  } catch (e) {
    console.error("writeLog failed:", (e as Error).message);
  }
}

export async function listLogs(opts: {
  level?: string;
  source?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};
  if (opts.level) where.level = opts.level;
  if (opts.source) where.source = opts.source;
  if (opts.search) {
    where.OR = [
      { message: { contains: opts.search, mode: "insensitive" } },
      { action: { contains: opts.search, mode: "insensitive" } },
      { source: { contains: opts.search, mode: "insensitive" } },
    ];
  }
  const limit = Math.min(opts.limit || 100, 500);
  const offset = opts.offset || 0;
  const [items, total] = await Promise.all([
    prisma.crmLog.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset }),
    prisma.crmLog.count({ where }),
  ]);
  return { items, total, limit, offset };
}

export async function clearLogs(olderThanDays: number = 7) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const { count } = await prisma.crmLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return { deleted: count };
}
