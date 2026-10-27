import type { ErrorRequestHandler, Request } from "express";
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function fail(status: number, message: string): never { throw new HttpError(status, message); }
export function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: unknown } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) fail(400, "Bilgiler geçersiz. Alanları ve şifre uzunluğunu kontrol edin.");
  return result.data;
}
export function idParam(req: Request): number {
  const n = Number(req.params.id);
  if (!Number.isSafeInteger(n) || n < 1) fail(400, "Geçersiz kayıt numarası.");
  return n;
}
export const handleError: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) { res.status(err.status).json({ error: err.message }); return; }
  if (err?.code === "23505" || err?.cause?.code === "23505") { res.status(409).json({ error: "Bu kullanıcı adı zaten kullanılıyor." }); return; }
  if (err?.code === "23503" || err?.cause?.code === "23503") { res.status(409).json({ error: "Bu kayıt kullanımda. Önce ilişkili kayıtları düzenleyin." }); return; }
  if (err?.type === "entity.parse.failed") { res.status(400).json({ error: "Geçersiz JSON." }); return; }
  req.log.error({ err }, "Request failed");
  res.status(500).json({ error: "İşlem tamamlanamadı. Lütfen yeniden deneyin." });
};
