import { describe, test } from "bun:test";

// ใช้ app.handle(new Request(...)) ไม่ต้องเปิด port
describe("GET /api/queue", () => {
  test.todo("returns winner, top3, fanGroups, excludedEntries for ?now=...&mode=normal");
  test.todo("rejects an invalid mode");
});

describe("PATCH /api/entries/:id/loyalty", () => {
  test.todo("updates loyalty points and the queue result reflects it");
  test.todo("404 for unknown id");
  test.todo("422 for negative loyaltyPoints");
});
