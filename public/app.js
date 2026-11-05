// สถานะของหน้า: เวลาในระบบและโหมดอยู่ฝั่ง client ส่งไปกับ query ทุกครั้ง ผลจึง deterministic
const START_NOW = new Date("2026-11-03T19:00:00+07:00");
const MODE_HINTS = {
  normal: "Score out of 100: waiting time up to 40, loyalty up to 35, ticket value up to 15, VIP 10. Each recent upgrade of the fan group subtracts 12.",
  rush: "Rush Hour: waiting time is worth up to 80 instead of 40.",
  vip: "VIP Hour: the VIP bonus rises from 10 to 25.",
  fair: "Fair Queue Mode: each recent upgrade subtracts 30 instead of 12.",
};

let now = new Date(START_NOW);
let mode = "normal";

const $ = (id) => document.getElementById(id);
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" });
const score = (value) => value.toFixed(1);

// entry มาจากข้อมูลผู้ใช้ ต้อง escape ก่อนใส่ลง innerHTML
function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${options?.method ?? "GET"} ${url} failed with ${response.status}`);
  return response.json();
}

function loadQueue() {
  const query = new URLSearchParams({ now: now.toISOString(), mode });
  return request(`/api/queue?${query}`);
}

function renderControls(eventStartsAt) {
  $("clock").textContent = timeFormat.format(now);
  $("modehint").textContent = MODE_HINTS[mode];
  if (!eventStartsAt) return;
  const minutesLeft = Math.round((new Date(eventStartsAt) - now) / 60000);
  $("countdown").textContent = minutesLeft > 0
    ? `Concert starts ${timeFormat.format(new Date(eventStartsAt))} (${minutesLeft} min left)`
    : `Concert started at ${timeFormat.format(new Date(eventStartsAt))}`;
}

function renderWinner(result) {
  const winner = result.winner;
  if (!winner) {
    $("winner").innerHTML = '<div class="none">No eligible entry right now.</div>';
    return;
  }
  const second = result.top3[1];
  const group = result.fanGroups.find((g) => g.representative?.entry.id === winner.entry.id);
  let summary = "Only eligible fan group.";
  if (second) {
    const gap = winner.score - second.score;
    summary = gap > 0
      ? `Leads #2 (${esc(second.entry.fanName)}) by ${score(gap)} points.`
      : "Tied with #2 on score; the earlier join time decides.";
  }
  if (group && group.entries.length > 1) {
    summary += ` Represents ${group.id} (${group.entries.length} linked accounts, only one competes).`;
  }
  const reasons = winner.reasons.map((reason) => `<li>${esc(reason)}</li>`).join("");
  $("winner").innerHTML = `
    <div class="name">${esc(winner.entry.fanName)} <span class="score">${score(winner.score)}</span></div>
    <p class="muted">${summary}</p>
    <ul class="plain">${reasons}</ul>`;
}

function renderTop3(result) {
  $("top3").innerHTML = result.top3.length
    ? result.top3.map((ranked, i) => {
        const group = result.fanGroups.find((g) => g.representative?.entry.id === ranked.entry.id);
        const label = group ? `${group.id}${group.entries.length > 1 ? ` (${group.entries.length} accounts)` : ""}` : "";
        return `<tr><td>${i + 1}</td><td>${esc(ranked.entry.fanName)}</td><td>${label}</td><td class="mono">${score(ranked.score)}</td></tr>`;
      }).join("")
    : '<tr><td colspan="4" class="muted">None</td></tr>';
}

function renderGroups(result) {
  const linked = result.fanGroups.filter((g) => g.entries.length > 1);
  $("groupSummary").textContent = `${linked.length} linked group(s); ${result.fanGroups.length - linked.length} single-account fans not shown.`;
  $("groups").innerHTML = linked.map((group) => {
    const chips = group.entries.map((entry) => {
      const isRep = group.representative?.entry.id === entry.id;
      return `<span class="pill${isRep ? " rep" : ""}">${esc(entry.fanName)}${isRep ? " (representative)" : ""}</span>`;
    }).join("");
    const links = group.connectionReasons.map((reason) => `<li>${esc(reason)}</li>`).join("");
    return `<div class="grp"><strong>${esc(group.id)}</strong><div class="chips">${chips}</div><ul class="plain muted">${links}</ul></div>`;
  }).join("");
}

function renderExcluded(result) {
  $("excluded").innerHTML = result.excludedEntries.length
    ? result.excludedEntries.map(({ entry, reason }) =>
        `<tr><td class="mono">${esc(entry.id)}</td><td>${esc(entry.fanName)}</td><td>${esc(reason)}</td></tr>`).join("")
    : '<tr><td colspan="3" class="muted">None</td></tr>';
}

function renderEntries(result) {
  // API ไม่มี endpoint รายการ entry ทั้งหมด จึงรวมจาก fanGroups (ทุก entry อยู่ในกลุ่มใดกลุ่มหนึ่ง)
  const entries = result.fanGroups.flatMap((g) => g.entries.map((entry) => ({ entry, groupId: g.id })));
  entries.sort((a, b) => a.entry.id.localeCompare(b.entry.id));
  const excludedIds = new Set(result.excludedEntries.map((x) => x.entry.id));
  const winnerId = result.winner?.entry.id;

  $("entries").innerHTML = entries.map(({ entry, groupId }) => {
    const status = excludedIds.has(entry.id) ? "excluded" : entry.id === winnerId ? "winner" : "eligible";
    return `<tr class="${status === "winner" ? "win" : ""}">
      <td class="mono">${esc(entry.id)}</td>
      <td>${esc(entry.fanName)}</td>
      <td>${esc(entry.status)}${entry.membership && entry.membership !== "regular" ? ` / ${esc(entry.membership)}` : ""}</td>
      <td><input type="number" min="0" step="50" data-id="${esc(entry.id)}" value="${Number(entry.loyaltyPoints) || 0}" aria-label="Loyalty points for ${esc(entry.fanName)}"></td>
      <td class="mono">${Number(entry.upgradesLast30Days) || 0}</td>
      <td class="mono">${esc(entry.ticketValue)}</td>
      <td>${esc(groupId)} · ${status}</td>
    </tr>`;
  }).join("");
}

async function render() {
  try {
    const result = await loadQueue();
    $("error").innerHTML = "";
    const eventStartsAt = result.fanGroups[0]?.entries[0]?.eventStartsAt;
    renderControls(eventStartsAt);
    renderWinner(result);
    renderTop3(result);
    renderGroups(result);
    renderExcluded(result);
    renderEntries(result);
  } catch (error) {
    $("error").innerHTML = `<div class="error">${esc(error.message)}</div>`;
  }
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.minutes) {
    now = new Date(now.getTime() + Number(button.dataset.minutes) * 60000);
  } else if (button.id === "reset") {
    await request("/api/reset", { method: "POST" });
    now = new Date(START_NOW);
    mode = "normal";
    $("mode").value = "normal";
  } else {
    return;
  }
  render();
});

$("mode").addEventListener("change", (event) => {
  mode = event.target.value;
  render();
});

// แก้ loyalty points: บันทึกเมื่อออกจากช่อง (change) แล้วคำนวณผลใหม่
$("entries").addEventListener("change", async (event) => {
  const input = event.target;
  if (!input.dataset.id) return;
  try {
    await request(`/api/entries/${encodeURIComponent(input.dataset.id)}/loyalty`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loyaltyPoints: Math.max(0, Number(input.value) || 0) }),
    });
  } catch (error) {
    $("error").innerHTML = `<div class="error">${esc(error.message)}</div>`;
    return;
  }
  render();
});

render();
