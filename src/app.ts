import { Elysia, file, status, t } from "elysia";
import { buildFrontRowUpgradeQueue } from "./queue";
import { SAMPLE_ENTRIES } from "./sample";

// store: เก็บ entries ในหน่วยความจำ (โจทย์ไม่ต้องใช้ฐานข้อมูล) รีเซ็ตได้ด้วย POST /api/reset
let entries = structuredClone(SAMPLE_ENTRIES);

export const app = new Elysia()
  .get("/", file("public/index.html"))
  .get("/app.js", file("public/app.js"))
  .get(
    "/api/queue",
    {
      query: t.Object({
        // เวลาปัจจุบันของระบบ ส่งมาจาก client (ปุ่ม +5 / +15 / +60 นาที) ให้ผล deterministic
        now: t.String({ format: "date-time" }),
        mode: t.Optional(t.Union([t.Literal("normal"), t.Literal("rush"), t.Literal("vip"), t.Literal("fair")])),
      }),
    },
    ({ query }) => buildFrontRowUpgradeQueue(entries, new Date(query.now), query.mode ?? "normal"),
  )
  .patch(
    "/api/entries/:id/loyalty",
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ loyaltyPoints: t.Number({ minimum: 0 }) }),
    },
    ({ params, body }) => {
      const index = entries.findIndex((e) => e.id === params.id);
      if (index === -1) return status(404, "Entry not found");
      // สร้าง object ใหม่แทนการแก้ของเดิม
      entries[index] = { ...entries[index], loyaltyPoints: body.loyaltyPoints };
      return entries[index];
    },
  )
  .post("/api/reset", () => {
    entries = structuredClone(SAMPLE_ENTRIES);
    return { ok: true };
  });

export type App = typeof app;
