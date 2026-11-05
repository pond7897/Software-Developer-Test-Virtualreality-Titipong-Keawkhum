# Front Row Ticket Upgrade Challenge

Bun + Elysia API with a plain HTML UI. All ranking logic lives in `src/queue.ts` and does not depend on Elysia.

## Run

```bash
bun install
bun run dev        # http://localhost:3000 (set PORT to change)
bun test
bun run typecheck
```

## Layout

```
src/
  queue.ts       all logic, no Elysia: types, normalize, grouping, scoring, buildFrontRowUpgradeQueue
  sample.ts      13 sample entries
  app.ts         Elysia app (store in memory, 3 API routes, serves public/), exports type App
  index.ts       listen only
public/
  index.html     UI
  app.js         UI logic, calls /api
test/
  normalize / grouping / queue / api tests
```

Routes: `GET /api/queue?now=&mode=`, `PATCH /api/entries/:id/loyalty`, `POST /api/reset`.
`now` and `mode` come from the client, so the same input always gives the same winner.

## Answers

### 1. How does your priority score work?
score = waiting time(40) + loyalty points(35) + ticket value(15) + vip(10) และ ลบ 12 ต่อการอัปเกรดล่าสุด (สูงสุด 5 ครั้ง)

### 2. How do you stop one fan group from dominating?
บัญชีที่ใช้เบอร์เดียวกัน หรือ เครื่องเดียวกัน หรือ ชื่อบัญชีเดียวกันจะนับเป็นคนเดียวกัน และถ้าบัญชีนั้นถูกบล็อคและบัญชีอื่นที่เกี่ยวข้องก็จะถูกแบนด้วยเช่นกัน เช่น บัญชี A ถูกบล็อค และ B ชื่อบัญชีที่ใช้โอนเป็นชื่อ A ดังนั้น B ก็จะถูกบล็อคด้วย

### 3. How do you break ties?
คะแนนสูงกว่าชนะ แต่ถ้าคะแนนเท่ากันจะให้คนที่เข้าคิวก่อนจะไม่มีการสุ่ม

### 4. What is the time complexity of your grouping logic?
O(n log n) 

### 5. What is one case where your system may still feel unfair?
ญาติหรือเพื่อนที่ใช้เบอร์ เครื่อง และบัญชีชำระเงินคนละอัน

### 6. How do Rush Hour, VIP Hour, and Fair Queue Mode work?
Rush Hour: waiting 80, VIP Hour: vip bonus 25, Fair Queue: Each recent upgrade cost 30  

### 7. What would you improve with more time?
ผูกบัตรประชาชน และ ปรับน้ำหนักจากข้อมูลจริง
