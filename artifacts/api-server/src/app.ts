import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { loadSession } from "./lib/auth";
import { fail, handleError } from "./lib/errors";

const app: Express = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin) {
      let host: string;
      try { host = new URL(origin).host; } catch { fail(403, "Geçersiz istek kaynağı."); }
      if (![req.get("host"), req.get("x-forwarded-host")].includes(host)) fail(403, "Bu kaynaktan işlem yapılamaz.");
    }
  }
  next();
});
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());
app.use(loadSession);

app.use("/api", router);
app.use(handleError);

export default app;
