import { victoryCondition, limitedCondition } from "./goals";
import {
  initialCampaign,
  campaignStep,
  viral,
  phagosomeSurvives,
} from "./infection";
import { coat, coatings } from "./opsonization";
import { populateTissue, syncTissueHealth } from "../content/anatomy";
import type {
  Cell,
  Colony,
  Order,
  TacticalCommand,
  TacticalContent,
  TacticalEvent,
  TacticalState,
  Vec,
} from "../domain/model";
import { STEP_SECONDS } from "../domain/model";
import { emit } from "./events";
import {
  initialImmunity,
  updateImmunity,
  supportDestination,
  supportCell,
  validHostTarget,
} from "./immunity";
export const copy = <T>(value: T): T => structuredClone(value);
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
export const fieldOf = (point: Vec, c: TacticalContent) =>
  [...c.fields].sort(
    (a, b) => distance(point, a.center) - distance(point, b.center),
  )[0];
export const occupied = (s: TacticalState, region: string) =>
  s.cells.filter((x) => x.region === region).length +
  s.arrivals.filter((x) => x.region === region).length;
export const loadOf = (s: TacticalState) =>
  s.colonies.reduce((n, p) => n + p.load, 0) +
  s.internal.reduce((n, p) => n + p.load, 0) +
  s.hosts.reduce((n, p) => n + p.load, 0);
export const preservation = (s: TacticalState) =>
  Math.round(
    Object.values(s.health).reduce((a, n) => a + n, 0) /
      Object.keys(s.health).length,
  );
export function walkable(point: Vec, c: TacticalContent): Vec {
  const field = fieldOf(point, c);
  const d = distance(point, field.center);
  if (d <= field.radius - 1) return { ...point };
  // Corridors connect all field centers; project onto their navigable ribbon.
  let nearest = { point: field.center, distance: d };
  for (let i = 0; i < c.fields.length; i++)
    for (let j = i + 1; j < c.fields.length; j++) {
      const a = c.fields[i].center,
        b = c.fields[j].center,
        dx = b.x - a.x,
        dz = b.z - a.z;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz),
        ),
      );
      const q = { x: a.x + dx * t, z: a.z + dz * t };
      const dd = distance(point, q);
      if (dd < nearest.distance) nearest = { point: q, distance: dd };
    }
  if (nearest.distance <= 2.6) return { ...point };
  return {
    x: field.center.x + ((point.x - field.center.x) / d) * (field.radius - 1),
    z: field.center.z + ((point.z - field.center.z) / d) * (field.radius - 1),
  };
}
function wave(s: TacticalState, c: TacticalContent) {
  const def = c.waves[s.wave + 1];
  if (!def) return;
  s.wave++;
  for (const group of def.groups) {
    const f = c.fields.find((r) => r.id === group.region)!;
    const jitter = ((s.seed % 3) - 1) * 0.6;
    const pos = {
      x: f.center.x + group.offset.x + jitter,
      z: f.center.z + group.offset.z,
    };
    s.colonies.push({
      id: `p${s.serial++}`,
      region: f.id,
      position: pos,
      load: group.load,
      markedUntil: 0,
      complementUntil: 0,
      antibodyUntil: 0,
      pathogen: c.pathogen.id,
      ...(c.mechanics === "fungal"
        ? { form: group.load >= 9 ? ("hypha" as const) : ("yeast" as const) }
        : {}),
    });
  }
  s.nextWaveAt = c.waves[s.wave + 1]
    ? s.tick + c.waves[s.wave + 1].after - def.after
    : c.limit;
  emit(
    s,
    "wave",
    c.fields[s.wave % c.fields.length].center,
    `第 ${s.wave + 1} 波：${def.label}。感染入口與負荷已標示。`,
    s.wave + 1,
  );
}
export function createTactical(c: TacticalContent, seed = 1): TacticalState {
  const s: TacticalState = {
    version: 2,
    scenario: c.id,
    seed: seed >>> 0 || 1,
    rng: seed >>> 0 || 1,
    tick: 0,
    energy: 5,
    support: 6,
    wave: -1,
    nextWaveAt: 0,
    health: Object.fromEntries(c.fields.map((f) => [f.id, 100])),
    cells: [],
    colonies: [],
    arrivals: [],
    internal: [],
    immunity: initialImmunity(c),
    hosts: [],
    serial: 1,
    eventId: 0,
    events: [],
  };
  for (const init of c.initial) {
    const f = c.fields.find((f) => f.id === init.region)!;
    const position = {
      x: f.center.x + init.offset.x,
      z: f.center.z + init.offset.z,
    };
    s.cells.push({
      id: `u${s.serial++}`,
      kind: init.kind,
      position,
      region: f.id,
      order: { type: "guard", point: { ...position } },
      path: [],
      readyAt: 0,
    });
  }
  wave(s, c);
  populateTissue(s, c);
  initialCampaign(s, c);
  return s;
}
function pathTo(cell: Cell, point: Vec, c: TacticalContent) {
  const from = fieldOf(cell.position, c),
    to = fieldOf(point, c);
  cell.path =
    from.id === to.id ? [point] : [{ ...from.center }, { ...to.center }, point];
}
export function validateTactical(
  s: TacticalState,
  cmd: TacticalCommand,
  c: TacticalContent,
): string | undefined {
  if (s.result) return "此局已結算，請重試。";
  if (cmd.type === "mark" || cmd.type === "antibody") {
    const p = s.colonies.find((p) => p.id === cmd.target && p.load > 0);
    if (!p) return "此菌群已清除。";
    const coating = coatings(p, s.tick);
    if (cmd.type === "antibody") {
      if (coating.antibody) return "抗體仍附著於此菌群，請支援其他目標。";
      if (s.immunity.antibodies < 1)
        return "尚無可用抗體；需要 B 細胞接受活化並分化為漿細胞。";
      return;
    }
    if (coating.complement) return "補體調理仍有效，請支援其他菌群。";
    if (!s.support) return "本案例的既存調理支援已用盡。";
    if (s.energy < c.markCost) return "反應資源不足，稍後會恢復。";
  } else if (cmd.type === "recruit") {
    const f = c.fields.find((f) => f.id === cmd.region);
    if (!f) return "目標區不存在。";
    if (!c.cells[cmd.kind]?.recruitable)
      return "此細胞由分化產生，不能直接募集。";
    if (s.energy < c.cells[cmd.kind].cost)
      return `需要 ${c.cells[cmd.kind].cost} 反應資源。`;
    if (s.health[f.id] <= 0) return "此區已失守。";
  } else if (cmd.type === "autoseek") {
    if (typeof cmd.enabled !== "boolean") return "尋敵設定無效。";
  } else if (cmd.type === "advance") {
    if (loadOf(s) > 0) return "先處理目前所有感染來源。";
    if (s.wave >= c.waves.length - 1) return "已是最後一波。";
  } else {
    const cell = s.cells.find((u) => u.id === cmd.cell);
    if (!cell) return "單位不存在。";
    if (cmd.type === "attack") {
      const p = s.colonies.find((p) => p.id === cmd.target && p.load > 0);
      const host = s.hosts.find((h) => h.id === cmd.target && h.load > 0);
      const role = c.cells[cell.kind].role;
      if (p && role === "presenter" && cell.antigen)
        return "此樹突細胞已攜帶抗原，正在引流呈遞；請用移動調度或改派吞噬者。";
      if (p && !["phagocyte", "presenter"].includes(role))
        return "此細胞不吞噬胞外菌；請查看細胞機制。";
      if (host && !validHostTarget(cell, host, c))
        return "缺少相符抗原／MHC 或壓力條件，不能攻擊此宿主。";
      if (!p && !host) return "目標菌群已清除。";
    }
    if (cmd.type === "move") {
      if (
        !Number.isFinite(cmd.point.x) ||
        !Number.isFinite(cmd.point.z) ||
        Math.abs(cmd.point.x) > 30 ||
        Math.abs(cmd.point.z) > 30
      )
        return "目的地超出戰場。";
    }
  }
}
export function commandTactical(
  before: TacticalState,
  cmd: TacticalCommand,
  c: TacticalContent,
): { state: TacticalState; error?: string } {
  const error = validateTactical(before, cmd, c);
  if (error) return { state: before, error };
  const s = copy(before);
  if (cmd.type === "mark") {
    const p = s.colonies.find((p) => p.id === cmd.target)!;
    s.energy -= c.markCost;
    s.support--;
    coat(p, "c3b", s.tick + c.markDuration);
    emit(
      s,
      "mark",
      p.position,
      "補體 C3b 已沉積；經補體受體促進吞噬，不直接裂解肺炎鏈球菌。",
      c.markDuration,
      { target: p.id, opsonin: "c3b", from: { ...c.portal } },
    );
  } else if (cmd.type === "antibody") {
    const p = s.colonies.find((p) => p.id === cmd.target)!;
    s.immunity.antibodies--;
    coat(p, "antibody", s.tick + 30);
    emit(
      s,
      "mark",
      p.position,
      "已指定漿細胞產生的抗體結合胞外菌，消耗 1 抗體；經 Fc 受體支援吞噬，不直接殺菌。",
      30,
      {
        target: p.id,
        opsonin: "antibody",
        from: {
          ...(s.cells.find((u) => u.kind === "plasma")?.position ??
            c.lymphExit ??
            c.portal),
        },
      },
    );
  } else if (cmd.type === "recruit") {
    const f = c.fields.find((f) => f.id === cmd.region)!;
    s.energy -= c.cells[cmd.kind].cost;
    s.arrivals.push({
      id: `q${s.serial++}`,
      kind: cmd.kind,
      region: f.id,
      at:
        s.tick +
        Math.max(
          5,
          c.cells[cmd.kind].delay -
            (cmd.kind === "neutrophil" && s.immunity.signals[f.id].cxcl8 >= 20
              ? 5
              : 0),
        ),
    });
    emit(
      s,
      "request",
      c.portal,
      `${c.cells[cmd.kind].name}向${f.name}集結，${(s.arrivals[s.arrivals.length - 1].at - s.tick) * STEP_SECONDS} 秒後到場${cmd.kind === "neutrophil" && s.immunity.signals[f.id].cxcl8 >= 20 ? "（CXCL8 促進募集）" : ""}。`,
      1,
    );
  } else if (cmd.type === "autoseek") {
    s.immunity.autoSeek = cmd.enabled;
    if (!cmd.enabled)
      for (const cell of s.cells)
        if (cell.order.type === "guard") cell.path = [];
    emit(
      s,
      "move",
      c.portal,
      cmd.enabled
        ? "自動尋敵已開啟：空閒吞噬者沿通道前往最近胞外菌；手動移動優先。"
        : "自動尋敵已關閉：維持指派與同區巡防。",
    );
  } else if (cmd.type === "advance") {
    wave(s, c);
    s.energy = Math.min(c.energyMax, s.energy + 1);
  } else {
    const cell = s.cells.find((u) => u.id === cmd.cell)!;
    let order: Order;
    if (cmd.type === "move") {
      const point = walkable(cmd.point, c);
      order = { type: "move", point };
      cell.region = fieldOf(point, c).id;
      pathTo(cell, point, c);
    } else if (cmd.type === "attack") {
      const p =
        s.colonies.find((p) => p.id === cmd.target) ??
        s.hosts.find((h) => h.id === cmd.target)!;
      order = { type: "attack", target: p.id };
      cell.region = p.region;
      pathTo(cell, p.position, c);
    } else {
      order = { type: "guard", point: { ...cell.position } };
      cell.path = [];
    }
    cell.order = order;
    emit(
      s,
      "move",
      cmd.type === "move" ? walkable(cmd.point, c) : cell.position,
      cmd.type === "move"
        ? "已指定防守位置。沿組織通道移動，抵達後自動處理附近病原。"
        : cmd.type === "attack"
          ? "已指定菌群；細胞將靠近後吞噬。"
          : "恢復就地巡防；自動選擇同區附近菌群。",
      0,
      { actor: cell.id, from: { ...cell.position } },
    );
  }
  return { state: s };
}
function walk(cell: Cell, speed: number) {
  let left = speed * STEP_SECONDS;
  while (left > 0 && cell.path.length) {
    const p = cell.path[0],
      d = distance(cell.position, p);
    if (d <= left) {
      cell.position = { ...p };
      cell.path.shift();
      left -= d;
    } else {
      cell.position.x += ((p.x - cell.position.x) / d) * left;
      cell.position.z += ((p.z - cell.position.z) / d) * left;
      left = 0;
    }
  }
}
export function stepTactical(
  before: TacticalState,
  c: TacticalContent,
): TacticalState {
  if (before.result) return before;
  const s = copy(before);
  s.tick++;
  if (s.tick % c.energyEvery === 0)
    s.energy = Math.min(c.energyMax, s.energy + 1);
  if (s.wave < c.waves.length - 1 && s.tick >= s.nextWaveAt) wave(s, c);
  for (const internal of s.internal) {
    if (internal.stage === "processing" && s.tick >= internal.clearAt) {
      const host = s.cells.find((u) => u.id === internal.host);
      emit(
        s,
        "clear",
        host?.position ?? c.fields[0].center,
        `吞噬體完成殺菌，清除 ${internal.load} 活負荷；吞入與死亡分開結算。`,
        internal.load,
        { actor: internal.host, target: internal.id },
      );
      internal.load = 0;
    }
  }
  s.internal = s.internal.filter((p) => p.load > 0);
  updateImmunity(s, c);
  campaignStep(s, c);
  for (const cell of s.cells) {
    const spec = c.cells[cell.kind];
    if (cell.order.type === "move") {
      walk(cell, spec.speed);
      if (!cell.path.length)
        cell.order = { type: "guard", point: { ...cell.position } };
      continue;
    }
    const destination = supportDestination(s, cell, c);
    if (destination) {
      const approach =
        ["helper", "bcell", "antibody"].includes(spec.role) ||
        (spec.role === "cytotoxic" && cell.activation !== "effector")
          ? 0.5
          : 2;
      if (distance(cell.position, destination) > approach) {
        if (
          !cell.path.length ||
          distance(cell.path[cell.path.length - 1], destination) > 0.1
        )
          pathTo(cell, destination, c);
        walk(cell, spec.speed);
      } else cell.path = [];
    }
    if (supportCell(s, cell, c)) continue;
    if (s.tick < cell.readyAt - spec.cooldown + 6) continue;
    let target: Colony | undefined;
    if (cell.order.type === "attack")
      target = s.colonies.find(
        (p) => p.id === (cell.order as { target: string }).target && p.load > 0,
      );
    if (!target)
      target = s.colonies
        .filter(
          (p) =>
            p.load > 0 &&
            (s.immunity.autoSeek ||
              (p.region === cell.region &&
                distance(cell.position, p.position) < 8)),
        )
        .sort(
          (a, b) =>
            distance(cell.position, a.position) -
              distance(cell.position, b.position) || a.id.localeCompare(b.id),
        )[0];
    if (target) {
      if (s.immunity.autoSeek) cell.region = target.region;
      if (distance(cell.position, target.position) > spec.range) {
        if (
          !cell.path.length ||
          distance(cell.path[cell.path.length - 1], target.position) > 0.1
        )
          pathTo(cell, target.position, c);
        walk(cell, spec.speed);
      }
      if (
        distance(cell.position, target.position) <= spec.range &&
        s.tick >= cell.readyAt
      ) {
        cell.path = [];
        if (target.form === "hypha" && cell.kind !== "dendritic") {
          cell.readyAt = s.tick + spec.cooldown;
          if (cell.kind === "neutrophil") {
            const n = Math.min(
              target.load,
              (3 + (s.campaign?.barrier[target.region] ?? 0) / 40) | 0,
            );
            target.load -= n;
            emit(
              s,
              "degranulate",
              target.position,
              "嗜中性球接觸菌絲，局部釋放顆粒破壞真菌膜；長菌絲未被整條吞入。",
              n,
              { actor: cell.id, target: target.id, from: { ...cell.position } },
            );
          }
          continue;
        }
        const survives = phagosomeSurvives(c, cell);
        const n = Math.min(
          target.load,
          spec.power +
            (target.markedUntil > s.tick ? spec.markedBonus : 0) +
            (cell.kind === "macrophage" &&
            s.immunity.signals[target.region].ifng >= 20
              ? 1
              : 0),
        );
        target.load -= n;
        if (spec.role === "presenter" && !cell.antigen) {
          cell.antigen = c.pathogen.antigen ?? `${c.pathogen.id}:protein`;
          if (s.immunity.node.stage === "idle") {
            s.immunity.node.stage = "migrating";
            s.immunity.node.antigen = cell.antigen;
          }
          emit(
            s,
            "present",
            cell.position,
            "樹突細胞已捕捉蛋白抗原，成熟後將由淋巴引流至淋巴結；吞入病原不等於直接活化所有淋巴球。",
            1,
            { actor: cell.id },
          );
        }
        cell.readyAt = s.tick + spec.cooldown;
        s.internal.push({
          id: `i${s.serial++}`,
          host: cell.id,
          pathogen: c.pathogen.id,
          load: n,
          compartment: "phagosome",
          stage: survives ? "persistent" : "processing",
          clearAt: survives
            ? 0
            : s.tick + (cell.kind === "neutrophil" ? 10 : 15),
        });
        emit(
          s,
          "engulf",
          target.position,
          `${spec.name}吞入 ${n} 負荷${target.markedUntil > s.tick ? "（調理支援）" : "（莢膜限制效率）"}${survives ? "，囊泡內仍有活菌。" : "，進入吞噬體，等待胞內殺菌。"}`,
          n,
          {
            actor: cell.id,
            target: target.id,
            from: { ...cell.position },
            survives,
          },
        );
        if (target.load === 0)
          emit(
            s,
            "clear",
            target.position,
            "此處已無胞外菌；已吞入的活菌仍需胞內處理。",
            n,
            {
              target: target.id,
            },
          );
      }
    } else if (cell.path.length) {
      walk(cell, spec.speed);
    } else if (cell.order.type === "attack")
      cell.order = { type: "guard", point: { ...cell.position } };
  }
  s.colonies = s.colonies.filter((p) => p.load > 0);
  if (!viral(c) && s.tick % c.growEvery === 0) {
    const spreading: Colony[] = [];
    for (const p of s.colonies) {
      if (
        c.mechanics === "containment" &&
        (s.campaign?.containment[p.region] ?? 0) >= 60
      )
        continue;
      p.load +=
        c.mechanics === "fungal" && (s.campaign?.barrier[p.region] ?? 0) >= 40
          ? 0
          : c.growth;
      emit(s, "grow", p.position, `殘餘菌群繁殖 +${c.growth}。`, c.growth, {
        target: p.id,
      });
      if (p.load >= c.spreadAt) {
        s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
        const fields = c.fields.filter((f) => f.id !== p.region);
        const f = fields[s.rng % fields.length];
        p.load -= 2;
        let to = s.colonies.find(
          (x) => x.region === f.id && x.markedUntil <= s.tick,
        );
        if (to) to.load += 2;
        else {
          to = {
            ...p,
            id: `p${s.serial++}`,
            region: f.id,
            position: { x: f.center.x + 2, z: f.center.z - 2 },
            load: 2,
            markedUntil: 0,
            complementUntil: 0,
            antibodyUntil: 0,
          };
          spreading.push(to);
        }
        emit(s, "spread", to.position, "高負荷菌群向相鄰組織擴散 2 負荷。", 2, {
          target: to.id,
          from: p.position,
        });
      }
    }
    s.colonies.push(...spreading);
  }
  if (s.tick % c.damageEvery === 0)
    for (const f of c.fields) {
      const load =
        s.colonies
          .filter((p) => p.region === f.id)
          .reduce((a, p) => a + p.load, 0) +
        s.internal
          .filter(
            (p) =>
              p.stage === "persistent" &&
              s.cells.find((u) => u.id === p.host)?.region === f.id,
          )
          .reduce((a, p) => a + p.load, 0);
      if (load || s.immunity.signals[f.id].inflammation > 60) {
        const damage =
          load * c.damagePerLoad +
          Math.max(0, s.immunity.signals[f.id].inflammation - 60) * 0.015;
        s.health[f.id] = Math.max(0, s.health[f.id] - damage);
        if (s.tick % 25 === 0)
          emit(
            s,
            "damage",
            f.center,
            `${f.name}殘餘感染與過強發炎造成組織損傷；降低發炎不會直接修復已失去的組織。`,
            Math.round(damage),
          );
      }
    }
  for (const arrival of [...s.arrivals])
    if (arrival.at <= s.tick) {
      const f = c.fields.find((f) => f.id === arrival.region)!;
      const nodeBound = ["helper", "bcell"].includes(
        c.cells[arrival.kind].role,
      );
      const destination = nodeBound ? (c.lymphExit ?? c.portal) : f.center;
      const cell: Cell = {
        id: `u${s.serial++}`,
        kind: arrival.kind,
        position: { ...c.portal },
        region: f.id,
        order: { type: "move", point: { ...destination } },
        path: [],
        readyAt: s.tick,
      };
      pathTo(cell, destination, c);
      s.cells.push(cell);
      s.arrivals = s.arrivals.filter((a) => a.id !== arrival.id);
      emit(
        s,
        "arrive",
        c.portal,
        `${c.cells[cell.kind].name}由微血管抵達，${nodeBound ? "先前往淋巴結接受活化；" : "正前往"}${f.name}${nodeBound ? "為後續支援防區" : ""}。`,
        1,
        { actor: cell.id },
      );
    }
  syncTissueHealth(s);
  if (c.practice) return s;
  const lost = Object.values(s.health).some((h) => h <= 0),
    won = victoryCondition(s, c);
  const limited = limitedCondition(s, c);
  if (lost || won || limited || s.tick >= c.limit) {
    const rate = preservation(s);
    s.result = {
      type: limited ? "limited" : !lost && won ? "victory" : "defeat",
      reason: limited
        ? "未治療情境：免疫支援已到本次觀察界限"
        : lost
          ? "必要組織失守"
          : won
            ? c.mechanics === "containment"
              ? "感染被穩定圍堵；仍有活菌，並非臨床治癒"
              : `${c.waves.length} 波感染來源均已清除`
            : "防禦時間內未能控制感染",
      preservation: rate,
      stars:
        !lost && won
          ? rate >= c.stars[0]
            ? 3
            : rate >= c.stars[1]
              ? 2
              : 1
          : 0,
      seconds: s.tick * STEP_SECONDS,
    };
    emit(s, "result", { x: 0, z: 0 }, s.result.reason, s.result.stars);
  }
  return s;
}
