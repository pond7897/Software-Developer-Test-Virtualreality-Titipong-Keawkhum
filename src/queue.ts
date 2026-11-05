export type TicketQueueEntry = {
  id: string;
  fanId: string;
  fanName: string;
  ticketValue: string | number | null;
  joinedQueueAt: string;
  eventStartsAt: string;
  status: "waiting" | "upgraded" | "cancelled";
  loyaltyPoints?: number | null;
  upgradesLast30Days?: number | null;
  membership?: "regular" | "vip" | "blocked";
  phoneNumber?: string | null;
  deviceId?: string | null;
  paymentAccount?: string | null;
};

export type Mode = "normal" | "rush" | "vip" | "fair";

export type RankedEntry = { entry: TicketQueueEntry; score: number; reasons: string[] };
export type FanGroup = {
  id: string;
  entries: TicketQueueEntry[];
  representative: RankedEntry | null;
  connectionReasons: string[];
};
export type ExcludedEntry = { entry: TicketQueueEntry; reason: string };
export type FrontRowUpgradeResult = {
  winner: RankedEntry | null;
  top3: RankedEntry[];
  fanGroups: FanGroup[];
  excludedEntries: ExcludedEntry[];
};

export function normalizePhone(_value: string | null | undefined): string | null {
  let numbers = _value?.replace(/\D/g, "");
  if (!numbers) return null;
  if (numbers.startsWith("00")) numbers = numbers.slice(2);
  if (numbers.startsWith("66") && numbers.length >= 10) {
    numbers = "0" + numbers.slice(2).replace(/^0+/, "");
  }
  return numbers;
}

export function normalizeText(_value: string | null | undefined): string | null {
  const txt = _value?.normalize("NFKC").replace(/\u200b/g, "").trim().toLowerCase();
  return txt || null;
}

export function parseTicketValue(_value: string | number | null | undefined): number | null {
  if (_value === null || _value === undefined) return null;

  let n: number;
  if (typeof _value === "number") {
    n = _value;
  } else {
    const cleaned = _value.replace(/,/g, "").trim();
    if (cleaned === "") return null;
    n = Number(cleaned);
  }

  if (isNaN(n) || n <= 0) return null;

  return n;
}

export type Grouping = {
  roots: number[];
  reasonsByRoot: Map<number, string[]>;
};

type ConnectionEdge = { from: number; to: number; reason: string };

export function groupEntries(_entries: readonly TicketQueueEntry[]): Grouping {
  const parent = _entries.map((_, i) => i);

  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }

  function union(i: number, j: number): void {
    const irep = find(i);
    const jrep = find(j);
    if (irep === jrep) return;

    if (irep < jrep) parent[jrep] = irep;
    else parent[irep] = jrep;
  }

  const firstEntryByPhone = new Map<string, number>();
  const firstEntryByDevice = new Map<string, number>();
  const firstEntryByPayment = new Map<string, number>();
  const edges: ConnectionEdge[] = [];

  function identify(
    firstEntryByValue: Map<string, number>,
    value: string | null,
    i: number,
    reason: string,
  ): void {
    if (value === null) return;
    const firstEntry = firstEntryByValue.get(value);
    if (firstEntry !== undefined) {
      edges.push({ from: firstEntry, to: i, reason: `${reason} (${value})` });

      union(firstEntry, i);
    } else {
      firstEntryByValue.set(value, i);
    }
  }

  _entries.forEach((entry, i) => {
    identify(firstEntryByPhone, normalizePhone(entry.phoneNumber), i, `same phone number`);
    identify(firstEntryByDevice, normalizeText(entry.deviceId ?? null), i, `same device`);
    identify(firstEntryByPayment, normalizeText(entry.paymentAccount ?? null), i, `same payment account`);
  })


  const roots = _entries.map((_, i) => find(i));
  const reasonsByRoot = new Map<number, string[]>();

  for (const edge of edges) {
    const root = find(edge.from);
    const message = `${_entries[edge.from].fanName} and ${_entries[edge.to].fanName}: ${edge.reason}`;
    const reasons = reasonsByRoot.get(root) ?? [];

    reasons.push(message);
    reasonsByRoot.set(root, reasons);
  }

  return { roots, reasonsByRoot };
}

// ===== scoring =====
// แต้มเต็มของแต่ละส่วน โหมด Normal รวม 100 (40 + 35 + 15 + 10) แล้วหักโทษอัปเกรดล่าสุด
// ทุกโหมดเปลี่ยนแค่ตัวเลขชุดนี้ ไม่แยก code path
export const MODES: Record<Mode, { wait: number; loyalty: number; value: number; vip: number; penalty: number }> = {
  normal: { wait: 40, loyalty: 35, value: 15, vip: 10, penalty: 12 },
  rush: { wait: 80, loyalty: 35, value: 15, vip: 10, penalty: 12 }, // เวลารอสำคัญเป็น 2 เท่า
  vip: { wait: 40, loyalty: 35, value: 15, vip: 25, penalty: 12 }, // VIP boost
  fair: { wait: 40, loyalty: 35, value: 15, vip: 10, penalty: 30 }, // โทษอัปเกรดล่าสุดหนักขึ้น
};

// TODO: คำนวณคะแนนของ entry หนึ่งตัว
// - loyalty: log scale เต็มที่ 10,000 แต้ม
// - wait: เส้นตรง 87.5% ที่ 4 ชม. แล้วค่อยๆ ขึ้นจนเต็มที่ 8 ชม. (กัน starvation)
// - value: log scale เต็มที่ 100,000
// - penalty: ใช้ upgradesLast30Days "รวมทั้งกลุ่ม" (กันสร้างบัญชีล้างประวัติ) นับสูงสุด 5 ครั้ง
// - สร้างข้อความ reasons เฉพาะ Top 3 (สร้างให้ 500k แถวจะช้า)
export function rank(
  _entry: TicketQueueEntry,
  _groupUpgrades: number,
  _now: Date,
  _mode: Mode,
): RankedEntry {
  const entry = _entry;
  let score = 0;
  const reasons: string[] = [];
  const loyaltyPoints = Math.max(0, entry.loyaltyPoints ?? 0);
  const loyaltyScore = Math.min(Math.log10(loyaltyPoints + 1) / Math.log10(10000 + 1), 1) * MODES[_mode].loyalty;
  const waitMinutes = Math.max(0, _now.getTime() - new Date(entry.joinedQueueAt).getTime()) / 60000 || 0;

  let waitScore = 0;
  if (waitMinutes <= 240) {
    waitScore = waitMinutes / 240 * 0.875 * MODES[_mode].wait;
  } else {
    waitScore = Math.min(1, 0.875 + (waitMinutes - 240) / 240 * 0.125) * MODES[_mode].wait;
  }

  const ticketValue = parseTicketValue(entry.ticketValue) ?? 0;
  const valueFraction = Math.min(1, Math.log10((ticketValue ?? 0) + 1) / Math.log10(100000 + 1));
  const valueScore = valueFraction * MODES[_mode].value;

  const vipScore = entry.membership === 'vip' ? MODES[_mode].vip : 0;;
  const penaltyScore = Math.min(_groupUpgrades, 5) * MODES[_mode].penalty;

  score = loyaltyScore + waitScore + valueScore + vipScore - penaltyScore;
  return { entry, score, reasons: [] };
}

// TODO: ลำดับเสมอภาพแบบ total order: คะแนนมากกว่า → joinedQueueAt เก่ากว่า → id ตามตัวอักษร
export function isBetter(_a: RankedEntry, _b: RankedEntry): boolean {
  const scoreDiff = _a.score - _b.score;
  if (scoreDiff !== 0) return scoreDiff > 0;

  const joinedDiff = new Date(_a.entry.joinedQueueAt).getTime() - new Date(_b.entry.joinedQueueAt).getTime();
  if (joinedDiff !== 0) return joinedDiff < 0;

  return _a.entry.id < _b.entry.id;
}

export function buildFrontRowUpgradeQueue(
  _entries: readonly TicketQueueEntry[],
  _now: Date,
  _mode: Mode = "normal",
): FrontRowUpgradeResult {
  const grouping = groupEntries(_entries);
  const membersByRoot = new Map<number, number[]>();
  const blockedRoots = new Set<number>();
  const upgradesByRoot = new Map<number, number>();

  const excludedEntries: ExcludedEntry[] = [];
  const bestByRoot = new Map<number, RankedEntry>();

  _entries.forEach((entry, i) => {
    const root = grouping.roots[i];
    const members = membersByRoot.get(root) ?? [];
    members.push(i);
    membersByRoot.set(root, members);

    if (entry.membership === "blocked") blockedRoots.add(root);

    const upgrades = Math.max(0, entry.upgradesLast30Days ?? 0);
    upgradesByRoot.set(root, upgrades + (upgradesByRoot.get(root) ?? 0));
  })

  _entries.forEach((entry, i) => {
    const root = grouping.roots[i];
    const reason = findExclusionReason(entry, _now, blockedRoots.has(root));
    if (reason) {
      excludedEntries.push({ entry, reason });
      return;
    }
    const ranked = rank(entry, upgradesByRoot.get(root) ?? 0, _now, _mode);
    const best = bestByRoot.get(root);
    if (!best || isBetter(ranked, best)) {
      bestByRoot.set(root, ranked);
    }
  })

  const top3 = [...bestByRoot.values()].sort((a, b) => (isBetter(a, b) ? -1 : 1)).slice(0, 3);
  const fanGroups: FanGroup[] = [...membersByRoot].map(([root, indexs], n) => ({
    id: `G${n + 1}`,
    entries: indexs.map((i) => _entries[i]),
    representative: bestByRoot.get(root) ?? null,
    connectionReasons: grouping.reasonsByRoot.get(root) ?? [],
  }));
  return { winner: top3[0] ?? null, top3, fanGroups, excludedEntries }
}

function findExclusionReason(
  entry: TicketQueueEntry,
  now: Date,
  groupHasBlockedFan: boolean,
): string | null {
  const eventStart = new Date(entry.eventStartsAt).getTime();

  if (entry.status === "cancelled") return "Cancelled entry";
  if (entry.status === "upgraded") return "Already upgraded";
  if (Number.isNaN(eventStart)) return "Invalid event start time";
  if (now.getTime() >= eventStart) return "Concert already started";
  if (entry.membership === "blocked") return "Blocked fan";
  if (parseTicketValue(entry.ticketValue) === null) return "Invalid ticket value";
  if (groupHasBlockedFan) return "Linked to a blocked fan";

  return null;
}