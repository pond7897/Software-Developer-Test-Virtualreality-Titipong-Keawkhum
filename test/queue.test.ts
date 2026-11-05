import { describe, test, expect } from "bun:test";
import { rank, type Mode, type TicketQueueEntry, buildFrontRowUpgradeQueue } from "../src/queue";

const NOW = new Date("2026-11-05T19:00:00+07:00");

const MOCK_DATA: TicketQueueEntry = {
  id: "e1",
  fanId: "f1",
  fanName: "Test",
  ticketValue: 1000,
  joinedQueueAt: "2026-11-05T19:00:00+07:00",
  eventStartsAt: "2026-11-05T20:00:00+07:00",
  status: "waiting",
  loyaltyPoints: 0,
  membership: "regular",
}

const score = (overrides: Partial<TicketQueueEntry> = {}, mode: Mode = "normal") => {
  const entry = { ...MOCK_DATA, ...overrides };
  const result = rank(entry, 0, NOW, mode);
  return result.score;
}

// entry ที่คะแนนสูงมาก ถ้าไม่ถูกตัดสิทธิ์จะชนะคู่แข่งปกติแน่ ใช้พิสูจน์ว่า "ชนะไม่ได้เพราะถูกตัด" ไม่ใช่ "แพ้คะแนน"
const STRONG = { loyaltyPoints: 10000, joinedQueueAt: "2026-11-05T11:00:00+07:00" };
// คู่แข่งปกติที่ไม่มีอะไรผิดกฎ ตัวนี้ต้องเป็นผู้ชนะเมื่อคนอื่นถูกตัด
const VALID = { ...MOCK_DATA, id: "valid", fanId: "f-valid", fanName: "Valid" };

const entryIds = (items: { entry: TicketQueueEntry }[]) => items.map((item) => item.entry.id);
const reasonOf = (result: ReturnType<typeof buildFrontRowUpgradeQueue>, id: string) =>
  result.excludedEntries.find((item) => item.entry.id === id)?.reason;

describe("buildFrontRowUpgradeQueue: required", () => {
  test("1. cancelled entries cannot win", () => {
    const result = buildFrontRowUpgradeQueue(
      [{ ...MOCK_DATA, ...STRONG, id: "cancelled", fanId: "f-c", status: "cancelled" }, VALID],
      NOW
    );

    expect(result.winner?.entry.id).toBe("valid");
    expect(entryIds(result.top3)).toEqual(["valid"]);
    expect(result.excludedEntries).toHaveLength(1);
    expect(reasonOf(result, "cancelled")).toBe("Cancelled entry");
  });

  test("2. entries after the concert start time cannot win", () => {
    const result = buildFrontRowUpgradeQueue(
      [
        { ...MOCK_DATA, ...STRONG, id: "after", fanId: "f-a", eventStartsAt: "2026-11-05T18:00:00+07:00" },
        { ...MOCK_DATA, ...STRONG, id: "exactly-now", fanId: "f-n", eventStartsAt: "2026-11-05T19:00:00+07:00" },
        VALID,
      ],
      NOW
    );

    expect(result.winner?.entry.id).toBe("valid");
    expect(result.excludedEntries).toHaveLength(2);
    expect(reasonOf(result, "after")).toBe("Concert already started");
    expect(reasonOf(result, "exactly-now")).toBe("Concert already started");
  });

  test("3. blocked fans cannot win", () => {
    const result = buildFrontRowUpgradeQueue(
      [{ ...MOCK_DATA, ...STRONG, id: "blocked", fanId: "f-b", membership: "blocked" }, VALID],
      NOW
    );

    expect(result.winner?.entry.id).toBe("valid");
    expect(result.excludedEntries).toHaveLength(1);
    expect(reasonOf(result, "blocked")).toBe("Blocked fan");
  });

  test("4. invalid or zero ticket values cannot win", () => {
    const invalidValues = [0, -5, "abc", null];
    const invalidEntries = invalidValues.map((ticketValue, i) => ({
      ...MOCK_DATA, ...STRONG, id: `invalid-${i}`, fanId: `f-invalid-${i}`, ticketValue,
    }));
    const result = buildFrontRowUpgradeQueue([...invalidEntries, VALID], NOW);

    expect(result.winner?.entry.id).toBe("valid");
    expect(result.excludedEntries).toHaveLength(4);
    for (const { entry } of result.excludedEntries) {
      expect(reasonOf(result, entry.id)).toBe("Invalid ticket value");
    }
  });

  test("5. different phone formatting connects entries (081-234-5678 / 081 234 5678 / 0812345678)", () => {
    const result = buildFrontRowUpgradeQueue(
      [
        { ...MOCK_DATA, id: "e1", fanId: "f1", phoneNumber: "081-234-5678" },
        { ...MOCK_DATA, id: "e2", fanId: "f2", phoneNumber: "081 234 5678" },
        { ...MOCK_DATA, id: "e3", fanId: "f3", phoneNumber: "0812345678" }
      ],
      NOW
    );

    expect(result.fanGroups).toHaveLength(1);
    expect(result.fanGroups[0].entries.map((entry) => entry.id)).toEqual(["e1", "e2", "e3"]);
    expect(result.fanGroups[0].connectionReasons).toHaveLength(2);
    for (const reason of result.fanGroups[0].connectionReasons) {
      expect(reason).toContain("same phone number (0812345678)");
    }
    expect(result.fanGroups[0].representative).not.toBeNull();
  });

  test("6. indirect connections create one fan group (A-B by phone, B-C by device)", () => {
    const result = buildFrontRowUpgradeQueue(
      [
        { ...MOCK_DATA, id: "e1", fanId: "f1", phoneNumber: "081-234-5678", deviceId: null },
        { ...MOCK_DATA, id: "e2", fanId: "f2", phoneNumber: "081 234 5678", deviceId: "D-100" },
        { ...MOCK_DATA, id: "e3", fanId: "f3", phoneNumber: null, deviceId: "D-100" }
      ],
      NOW
    );

    expect(result.fanGroups).toHaveLength(1);
    expect(result.fanGroups[0].entries.map((entry) => entry.id)).toEqual(["e1", "e2", "e3"]);
    const reasons = result.fanGroups[0].connectionReasons.join("\n");
    expect(reasons).toContain("same phone number");
    expect(reasons).toContain("same device (d-100)");
    expect(entryIds(result.top3)).toHaveLength(1);
  });

  test("7. the same input always gives the same winner (also with shuffled input)", () => {
    const input = [
      { ...MOCK_DATA, id: "e1", fanId: "f1", joinedQueueAt: "2026-11-05T19:00:00+07:00" },
      { ...MOCK_DATA, id: "e2", fanId: "f2", joinedQueueAt: "2026-11-05T18:00:00+07:00" },
      { ...MOCK_DATA, id: "e3", fanId: "f3", joinedQueueAt: "2026-11-05T17:00:00+07:00" },
      { ...MOCK_DATA, id: "e4", fanId: "f4", phoneNumber: "081-111-1111", upgradesLast30Days: 2 },
      { ...MOCK_DATA, id: "e5", fanId: "f5", phoneNumber: "0811111111", deviceId: "D-1", upgradesLast30Days: 1 },
    ];
    const expected = buildFrontRowUpgradeQueue(input, NOW);

    expect(expected.winner?.entry.id).toBe("e3");
    expect(buildFrontRowUpgradeQueue(input, NOW).winner?.entry.id).toBe("e3");

    const orders = [[...input].reverse()];
    for (let shift = 1; shift < input.length; shift++) {
      orders.push([...input.slice(shift), ...input.slice(0, shift)]);
    }
    for (const order of orders) {
      const result = buildFrontRowUpgradeQueue(order, NOW);
      expect(result.winner?.entry.id).toBe("e3");
      expect(entryIds(result.top3)).toEqual(entryIds(expected.top3));
      expect(result.winner?.score).toBeCloseTo(expected.winner!.score);
    }
  });
});

describe("buildFrontRowUpgradeQueue: edge cases we found", () => {
  test("8. an account linked to a blocked account is excluded with its whole group", () => {
    const blocked = { ...MOCK_DATA, id: "e1", fanId: "f1", membership: "blocked" as const, phoneNumber: "081-234-5678" };
    const linked = { ...MOCK_DATA, ...STRONG, id: "e2", fanId: "f2", phoneNumber: "0812345678" };
    const other = { ...MOCK_DATA, id: "e3", fanId: "f3" };

    for (const input of [[linked, blocked, other], [blocked, linked, other], [other, linked, blocked]]) {
      const result = buildFrontRowUpgradeQueue(input, NOW);

      expect(result.winner?.entry.id).toBe("e3");
      expect(result.excludedEntries).toHaveLength(2);
      expect(reasonOf(result, "e1")).toBe("Blocked fan");
      expect(reasonOf(result, "e2")).toBe("Linked to a blocked fan");
      const group = result.fanGroups.find((g) => g.entries.length === 2);
      expect(group?.representative).toBeNull(); // ทั้งกลุ่มไม่มีตัวแทน
    }
  });

  test("9. empty or whitespace-only device/phone/payment values never connect accounts", () => {
    const result = buildFrontRowUpgradeQueue([
      { ...MOCK_DATA, id: "e1", fanId: "f1", deviceId: "", phoneNumber: "", paymentAccount: "" },
      { ...MOCK_DATA, id: "e2", fanId: "f2", deviceId: "   ", phoneNumber: "   ", paymentAccount: "   " },
      { ...MOCK_DATA, id: "e3", fanId: "f3", deviceId: null, phoneNumber: null, paymentAccount: null },
      { ...MOCK_DATA, id: "e4", fanId: "f4", deviceId: "​", phoneNumber: "---", paymentAccount: undefined },
    ], NOW);

    expect(result.fanGroups).toHaveLength(4);
    expect(result.fanGroups.every((group) => group.entries.length === 1)).toBe(true);
    expect(result.fanGroups.flatMap((group) => group.connectionReasons)).toEqual([]);
    expect(result.excludedEntries).toHaveLength(0);
    expect(result.winner).not.toBeNull();
  });
});

describe("buildFrontRowUpgradeQueue: tie-break", () => {
  // รอเกิน 8 ชั่วโมงทั้งคู่ แต้มเวลารอเต็ม 40 เท่ากัน จึงได้คะแนนรวมเท่ากันทั้งที่เวลาเข้าคิวต่างกัน
  const joined12hAgo = "2026-11-05T07:00:00+07:00";
  const joined10hAgo = "2026-11-05T09:00:00+07:00";

  test("equal score: the entry that joined the queue earlier wins, in any input order", () => {
    const early = { ...MOCK_DATA, id: "b", fanId: "f-b", joinedQueueAt: joined12hAgo };
    const late = { ...MOCK_DATA, id: "a", fanId: "f-a", joinedQueueAt: joined10hAgo };

    for (const input of [[early, late], [late, early]]) {
      const result = buildFrontRowUpgradeQueue(input, NOW);

      expect(result.top3[0].score).toBeCloseTo(result.top3[1].score); // ยืนยันว่าเป็นกรณีคะแนนเท่ากันจริง
      expect(entryIds(result.top3)).toEqual(["b", "a"]);               // b เข้าคิวก่อน ชนะแม้ id ใหญ่กว่า
      expect(result.winner?.entry.id).toBe("b");
    }
  });

  test("equal score and equal join time: the smaller id wins, in any input order", () => {
    const first = { ...MOCK_DATA, id: "e1", fanId: "f1" };
    const second = { ...MOCK_DATA, id: "e2", fanId: "f2" };

    for (const input of [[first, second], [second, first]]) {
      const result = buildFrontRowUpgradeQueue(input, NOW);

      expect(result.top3[0].score).toBeCloseTo(result.top3[1].score);
      expect(entryIds(result.top3)).toEqual(["e1", "e2"]);
      expect(result.winner?.entry.id).toBe("e1");
    }
  });

  test("a higher score still beats an earlier join time", () => {
    const earlyButWeak = { ...MOCK_DATA, id: "weak", fanId: "f-w", joinedQueueAt: joined12hAgo };
    const lateButStrong = { ...MOCK_DATA, id: "strong", fanId: "f-s", joinedQueueAt: joined10hAgo, membership: "vip" as const };

    const result = buildFrontRowUpgradeQueue([earlyButWeak, lateButStrong], NOW);

    expect(result.winner?.entry.id).toBe("strong"); // VIP +10 ชนะ ทั้งที่เข้าคิวหลัง
  });
});

describe("rank", () => {
  test("VIP gets 10 more points than regular in normal mode", () => {
    const diff = score({ membership: "vip" }, "normal") - score({ membership: "regular" }, "normal");

    expect(diff).toBeCloseTo(10);
  });

  test("gives 35 waiting points after 4 hours and 40 after 8 hours in normal mode", () => {
    const now = score();
    const after4h = score({ joinedQueueAt: "2026-11-05T15:00:00+07:00" });
    const after8h = score({ joinedQueueAt: "2026-11-05T11:00:00+07:00" });

    expect(after4h - now).toBeCloseTo(35);
    expect(after8h - now).toBeCloseTo(40);
  });

  test("gives the full 35 loyalty points at 10,000 and no more above that in normal mode", () => {
    const baseline = score();
    const at10k = score({ loyaltyPoints: 10000 });
    const at20k = score({ loyaltyPoints: 1_000_000 }); // more than 10k should not give more points

    expect(at10k - baseline).toBeCloseTo(35);
    expect(at20k).toBeCloseTo(at10k);
  });

  test("subtracts 12 points per recent upgrade and counts at most 5 in normal mode", () => {
    const upgrade = (n: number) => rank({ ...MOCK_DATA }, n, NOW, "normal").score;

    expect(upgrade(0) - upgrade(2)).toBeCloseTo(24);
    expect(upgrade(10)).toBeCloseTo(upgrade(5));
  });

  test("does not return NaN for negative loyalty points or an unparsable join time", () => {
    const baseline = score();
    const negativeLoyalty = score({ loyaltyPoints: -100 });
    const unparsableJoinTime = score({ joinedQueueAt: "not-a-date" });

    expect(negativeLoyalty).not.toBeNaN();
    expect(unparsableJoinTime).not.toBeNaN();
    expect(negativeLoyalty).toBeCloseTo(baseline); // ค่าผิดปกติถูกมองเป็น 0 ไม่ใช่เพี้ยนไปทางอื่น
    expect(unparsableJoinTime).toBeCloseTo(baseline);
  });
})
