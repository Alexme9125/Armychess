import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { isLayoutLegal, type Layout } from "@armychess/engine";
import { getBlueprint, saveBlueprint } from "./blueprints.ts";
import { attachSockets } from "./rooms.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);

const app = express();
app.use(cors());
app.use(express.json({ limit: "200kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/blueprints", (req, res) => {
  const layout = req.body?.placements as Layout | undefined;
  if (!Array.isArray(layout)) {
    res.status(400).json({ error: "缺少 placements" });
    return;
  }
  if (!isLayoutLegal(layout)) {
    res.status(400).json({ error: "阵型不合法，请检查军旗、地雷、炸弹与棋子数量" });
    return;
  }
  try {
    const code = saveBlueprint(layout);
    res.json({ code });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "保存失败" });
  }
});

app.get("/api/blueprints/:code", (req, res) => {
  const code = String(req.params.code ?? "").trim().toUpperCase();
  const layout = getBlueprint(code);
  if (!layout) {
    res.status(404).json({ error: "蓝图不存在或为人机彩蛋码" });
    return;
  }
  res.json({ code, placements: layout });
});

const webDist = join(__dir, "../../web/dist");
app.use(express.static(webDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) return next();
  res.sendFile(join(webDist, "index.html"), (err) => {
    if (err) next();
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true },
});
attachSockets(io);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`陆军棋服务器 http://localhost:${PORT}`);
});
