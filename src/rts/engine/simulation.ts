import type {
  State,
  Unit,
  Point,
  Command,
  Scenario,
  NodePhase,
  Pathogen,
} from "../domain/types";
import { validateScenario } from "../content/validate";
import { M1, ANTIGEN } from "../content/m1";
export const GRID_W = 25,
  GRID_H = 17;
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function random(s: State) {
  s.rng = (Math.imul(1664525, s.rng) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
export function event(
  s: State,
  type: string,
  text: string,
  actor?: string,
  target?: string,
  at?: Point,
) {
  s.events.push({
    id: `e${++s.serial}`,
    step: s.step,
    type,
    text,
    actor,
    target,
    at: at ? { x: at.x, y: at.y } : undefined,
  });
}
export function makeUnit(s: State, kind: Unit["kind"], p: Point): Unit {
  return {
    id: `u${++s.serial}`,
    kind,
    visualId: `cell.${kind}.v1`,
    ...p,
    action: "patrol",
    since: s.step,
    until: s.step,
    life: kind === "neutrophil" ? 650 : 1e9,
    signal: false,
  };
}
export function spawn(s: State, p: Point, load = 4, survives = false) {
  const b: Pathogen = {
    id: `p${++s.serial}`,
    ...p,
    visualId: "pathogen.spn.v1",
    load,
    opsonin: "none",
    opsAt: 0,
    compartment: "external",
    survives,
    born: s.step,
    heading: random(s) * Math.PI * 2,
    antigen: ANTIGEN,
  };
  s.pathogens.push(b);
  return b;
}
export function createState(seed = 5504, c: Scenario = M1): State {
  validateScenario(c);
  const s: State = {
    schema: 3,
    contentVersion: c.version,
    scenarioId: c.id,
    seed,
    rng: seed >>> 0,
    step: 0,
    serial: 0,
    units: [],
    pathogens: [],
    field: Array(GRID_W * GRID_H).fill(0),
    inflammation: 0,
    endothelial: 0,
    tissue: 100,
    damage: { pathogen: 0, inflammation: 0, bystander: 0 },
    resources: c.resources,
    supply: c.supply,
    recruits: [],
    node: { phase: "antigen", until: 0, supported: false },
    policy: "balanced",
    sourceClosed: false,
    processed: [],
    events: [],
    stats: { cleared: 0, recruited: 0, captures: 0 },
  };
  s.units = c.initial.map((u) => makeUnit(s, u.kind, u));
  c.foci.forEach((p) => spawn(s, p));
  return s;
}
function setAction(s: State, u: Unit, a: Unit["action"], duration = 0) {
  u.action = a;
  u.since = s.step;
  u.until = s.step + duration;
}
function move(u: Point, to: Point, speed: number, c: Scenario) {
  const d = distance(u, to);
  if (d > 0) {
    u.x = clamp(
      u.x + ((to.x - u.x) / d) * Math.min(speed, d),
      35,
      c.width - 35,
    );
    u.y = clamp(
      u.y + ((to.y - u.y) / d) * Math.min(speed, d),
      35,
      c.tissueBottom,
    );
  }
}
export function sample(s: State, p: Point, c: Scenario = M1) {
  const x = clamp((p.x / c.width) * GRID_W - 0.5, 0, GRID_W - 1),
    y = clamp((p.y / c.height) * GRID_H - 0.5, 0, GRID_H - 1),
    a = Math.floor(x),
    b = Math.floor(y),
    fx = x - a,
    fy = y - b;
  return (
    (s.field[b * GRID_W + a] * (1 - fx) +
      s.field[b * GRID_W + Math.min(a + 1, GRID_W - 1)] * fx) *
      (1 - fy) +
    (s.field[Math.min(b + 1, GRID_H - 1) * GRID_W + a] * (1 - fx) +
      s.field[
        Math.min(b + 1, GRID_H - 1) * GRID_W + Math.min(a + 1, GRID_W - 1)
      ] *
        fx) *
      fy
  );
}
function gridIndex(p: Point, c: Scenario) {
  return (
    clamp(Math.floor((p.y / c.height) * GRID_H), 0, GRID_H - 1) * GRID_W +
    clamp(Math.floor((p.x / c.width) * GRID_W), 0, GRID_W - 1)
  );
}
export function cost(cmd: Command, c: Scenario = M1) {
  return cmd.type === "recruit"
    ? c.costs.recruit
    : cmd.type === "opsonize"
      ? c.costs.opsonize
      : cmd.type === "support"
        ? c.costs.support
        : 0;
}
export function validate(
  s: State,
  cmd: Command,
  c: Scenario = M1,
): string | undefined {
  if (s.result) return "本局已結算";
  if (s.processed.includes(cmd.id)) return "重複指令";
  if (s.resources + 1e-6 < cost(cmd, c)) return "反應資源不足";
  if (
    cmd.point &&
    (!Number.isFinite(cmd.point.x) ||
      !Number.isFinite(cmd.point.y) ||
      cmd.point.x < 35 ||
      cmd.point.x > c.width - 35 ||
      cmd.point.y < 35 ||
      cmd.point.y > c.tissueBottom)
  )
    return "位置不在可通行組織（血管內不可直接調度）";
  if (["move", "target", "auto", "dispatch"].includes(cmd.type)) {
    const u = s.units.find((u) => u.id === cmd.unit && u.action !== "exit");
    if (!u) return "找不到可用細胞";
    if (cmd.type === "dispatch" && (u.kind !== "dendritic" || !u.antigen))
      return "DC 尚未攝取指定蛋白抗原";
    if (cmd.type === "move" && !cmd.point) return "缺少目的位置";
  }
  if (
    cmd.type === "target" &&
    !s.pathogens.some(
      (b) => b.id === cmd.target && b.compartment === "external" && b.load > 0,
    )
  )
    return "目標已離場或無法接觸";
  if (
    cmd.type === "opsonize" &&
    !s.pathogens.some(
      (b) => b.id === cmd.target && b.compartment === "external" && b.load > 0,
    )
  )
    return "請選取胞外病原";
  if (cmd.type === "recruit" && (!cmd.point || s.supply < 1))
    return "募集供應不足或缺少支援位置";
  if (cmd.type === "support" && (s.node.supported || s.node.phase === "active"))
    return "淋巴結已獲支援或反應完成";
  if (
    cmd.type === "policy" &&
    !["restrained", "balanced", "intense"].includes(cmd.policy ?? "")
  )
    return "未知政策";
}
export function commit(s: State, cmd: Command, c: Scenario = M1) {
  if (s.processed.includes(cmd.id)) return;
  const reason = validate(s, cmd, c);
  s.processed.push(cmd.id);
  if (reason) {
    event(s, "rejected", reason, cmd.unit, cmd.target);
    return;
  }
  s.resources -= cost(cmd, c);
  const u = s.units.find((x) => x.id === cmd.unit);
  switch (cmd.type) {
    case "move":
      if (u) {
        u.order = cmd.point;
        u.priority = undefined;
      }
      break;
    case "target":
      if (u) {
        u.priority = cmd.target;
        u.order = undefined;
      }
      break;
    case "auto":
      if (u) {
        u.order = undefined;
        u.priority = undefined;
      }
      break;
    case "opsonize": {
      const b = s.pathogens.find((b) => b.id === cmd.target)!;
      b.opsonin = "complement";
      b.opsAt = s.step;
      event(
        s,
        "opsonize",
        "補體沉積於莢膜表面 → 提高後續攝入；不直接殺菌",
        undefined,
        b.id,
        b,
      );
      break;
    }
    case "recruit":
      s.supply -= 1;
      s.recruits.push({
        id: `r${++s.serial}`,
        point: cmd.point!,
        phase: "waiting",
        until: 0,
        entrance: { x: 120 + random(s) * 80, y: 520 },
      });
      event(
        s,
        "recruit",
        "募集已排程：等待內皮活化；不預約區域名額",
        undefined,
        undefined,
        cmd.point,
      );
      break;
    case "policy":
      s.policy = cmd.policy!;
      event(s, "policy", `反應政策：${s.policy}；影響內皮／發炎與防禦`);
      break;
    case "dispatch":
      if (u && s.node.dc === u.id && s.node.phase === "maturation") {
        s.node.until = Math.max(s.step + 5, s.node.until - 10);
        event(s, "dispatch", "優先成熟與交通，仍需攝取及遷移時間", u.id);
      }
      break;
    case "support":
      s.node.supported = true;
      event(s, "support", "淋巴結獲資源支援：分化準備加速 20%，不跳階段");
      break;
  }
  event(s, "command", `已提交 ${cmd.type}`, cmd.unit, cmd.target, cmd.point);
}
const phaseOrder: NodePhase[] = [
  "maturation",
  "migration",
  "presentation",
  "bActivation",
  "differentiation",
  "transport",
  "active",
];
function advanceNode(s: State, c: Scenario) {
  if (
    s.node.phase === "antigen" ||
    s.node.phase === "active" ||
    s.step < s.node.until
  )
    return;
  const prev = s.node.phase,
    next = phaseOrder[phaseOrder.indexOf(prev) + 1];
  if (!next) return;
  const dc = s.units.find((u) => u.id === s.node.dc);
  if (prev === "migration" && dc) {
    dc.x = 900;
    dc.y = 100;
    setAction(s, dc, "exit");
  }
  s.node.phase = next;
  s.node.until =
    s.step +
    (next === "active"
      ? 0
      : Math.ceil(
          c.stages[next as keyof typeof c.stages] *
            (s.node.supported ? 0.8 : 1),
        ));
  if (next === "migration" && dc)
    setAction(s, dc, "migrate", s.node.until - s.step);
  event(s, "node", `淋巴結階段：${next}（${ANTIGEN}）`, dc?.id);
  if (next === "active")
    event(s, "antibody", "新生蛋白靶向抗體到場 → 調理暴露同抗原；不直接清除");
}
function field(s: State, c: Scenario) {
  const old = s.field;
  s.field = old.map((v, i) => {
    const x = i % GRID_W,
      y = Math.floor(i / GRID_W);
    const n =
      (x ? old[i - 1] : v) +
      (x < GRID_W - 1 ? old[i + 1] : v) +
      (y ? old[i - GRID_W] : v) +
      (y < GRID_H - 1 ? old[i + GRID_W] : v);
    return clamp((v + c.signalDiffusion * (n - 4 * v)) * c.signalDecay, 0, 12);
  });
  let sources = 0;
  for (const u of s.units) {
    u.signal = false;
    if (u.action === "exit") continue;
    const near = s.pathogens.some(
      (b) => b.compartment === "external" && distance(u, b) < 190 && b.load > 0,
    );
    if (near && u.kind !== "neutrophil") {
      u.signal = true;
      s.field[gridIndex(u, c)] = Math.min(
        12,
        s.field[gridIndex(u, c)] + c.signalStrength,
      );
      sources++;
      if (s.step % 50 === 0)
        event(
          s,
          "signal",
          "辨識感染 → 局部 CXCL8 釋放；TNF／IL-1 相關發炎促進內皮",
          u.id,
          undefined,
          u,
        );
    }
  }
  const factor =
    s.policy === "intense" ? 1.8 : s.policy === "restrained" ? 0.3 : 1;
  const demand =
    Math.min(
      1,
      sources * 0.22 +
        s.pathogens.filter((b) => b.compartment === "external").length * 0.05,
    ) * factor;
  s.inflammation = clamp(
    s.inflammation + (demand * 60 - s.inflammation) * 0.012,
    0,
    100,
  );
  s.endothelial = clamp(
    s.endothelial + (s.inflammation - s.endothelial) * 0.018,
    0,
    100,
  );
}
function recruit(s: State, c: Scenario) {
  for (const r of s.recruits) {
    if (r.phase === "waiting" && s.endothelial >= 8) {
      r.phase = "mobilizing";
      r.until = s.step + c.recruitDelay;
      event(
        s,
        "mobilizing",
        "內皮條件成立 → 血管內動員開始",
        undefined,
        r.id,
        r.entrance,
      );
    } else if (r.phase === "mobilizing" && s.step >= r.until) {
      r.phase = "crossing";
      r.until = s.step + c.crossing;
      event(
        s,
        "crossing",
        "細胞黏附並跨越活化內皮",
        undefined,
        r.id,
        r.entrance,
      );
    } else if (r.phase === "crossing" && s.step >= r.until) {
      const u = makeUnit(s, "neutrophil", {
        x: r.entrance.x,
        y: r.entrance.y - 30,
      });
      u.order = { ...r.point };
      s.units.push(u);
      s.stats.recruited++;
      event(
        s,
        "arrival",
        "增援從血管到場 → 前往支援位置並沿 CXCL8 趨化",
        u.id,
        r.id,
        u,
      );
    }
  }
  s.recruits = s.recruits.filter(
    (r) => !(r.phase === "crossing" && s.step >= r.until),
  );
}
function ai(s: State, c: Scenario) {
  for (const u of s.units) {
    if (u.action === "exit") continue;
    if (u.kind === "neutrophil" && --u.life <= 0) {
      const cargo = s.pathogens.find((b) => b.id === u.cargo);
      if (cargo) {
        cargo.compartment = "external";
        cargo.host = undefined;
        cargo.x = u.x;
        cargo.y = u.y;
        event(
          s,
          "release",
          "宿主壽命結束 → 尚存活病原回到胞外，不能當作清除",
          u.id,
          cargo.id,
          u,
        );
      }
      u.cargo = undefined;
      u.target = undefined;
      setAction(s, u, "exit");
      event(s, "expiry", "嗜中性球壽命結束", u.id);
      continue;
    }
    if (u.action === "mature") continue;
    if (u.action === "migrate") {
      move(u, { x: 900, y: 100 }, 5, c);
      continue;
    }
    const b = s.pathogens.find((b) => b.id === u.target);
    if (
      ["contact", "wrap", "ingest", "digest", "survive", "cooldown"].includes(
        u.action,
      )
    ) {
      if (s.step < u.until) continue;
      if (u.action === "cooldown") {
        u.target = undefined;
        setAction(s, u, "patrol");
        continue;
      }
      if (!b || b.load <= 0) {
        u.target = undefined;
        setAction(s, u, "cooldown", 10);
        continue;
      }
      if (u.action === "contact") {
        const efficiency = b.opsonin === "none" ? 0.26 : 0.96;
        if (random(s) > efficiency) {
          event(
            s,
            "capsule",
            "莢膜使未充分調理攝入低效 → 本次未攝入",
            u.id,
            b.id,
            b,
          );
          setAction(s, u, "cooldown", 20);
          continue;
        }
        setAction(s, u, "wrap", 8);
        event(s, "wrap", "接觸成立 → 連續偽足包覆", u.id, b.id, b);
      } else if (u.action === "wrap") {
        // Target reservation is for one contact action only, never spatial capacity.
        b.compartment = "internal";
        b.host = u.id;
        u.cargo = b.id;
        setAction(s, u, "ingest", 7);
        event(
          s,
          "ingest",
          "膜合攏 → 目標進入胞內囊泡（尚未清除）",
          u.id,
          b.id,
          u,
        );
      } else if (u.action === "ingest") {
        if (u.kind === "dendritic") {
          u.antigen = b.antigen;
          s.stats.captures++;
          b.load = 0;
          u.cargo = undefined;
          if (s.node.phase === "antigen") {
            s.node = {
              phase: "maturation",
              until: s.step + c.stages.maturation,
              antigen: b.antigen,
              dc: u.id,
              supported: s.node.supported,
            };
            setAction(s, u, "mature");
            event(
              s,
              "antigen",
              "DC 已攝取蛋白抗原 → 成熟與遷移準備",
              u.id,
              b.id,
              u,
            );
          } else setAction(s, u, "cooldown", 20);
        } else {
          setAction(
            s,
            u,
            b.survives ? "survive" : "digest",
            b.survives ? 40 : 12,
          );
          event(
            s,
            b.survives ? "survival" : "processing",
            b.survives
              ? "受控示範：吞入後仍有活菌"
              : "胞內處理開始，等待清除結果",
            u.id,
            b.id,
            u,
          );
        }
      } else if (u.action === "digest") {
        s.stats.cleared += b.load;
        b.load = 0;
        u.cargo = undefined;
        event(s, "clear", "胞內分解完成 → 已清除", u.id, b.id, u);
        setAction(s, u, "cooldown", 18);
      } else if (u.action === "survive") {
        u.until = s.step + 40;
        event(s, "survival", "囊泡內病原仍存活；吞入不等於清除", u.id, b.id, u);
      }
      continue;
    }
    if (u.order) {
      move(u, u.order, u.kind === "neutrophil" ? 4 : 2.8, c);
      setAction(s, u, "approach");
      if (distance(u, u.order) < 5) u.order = undefined;
      continue;
    }
    const candidates = s.pathogens.filter(
      (b) =>
        b.load > 0 &&
        b.compartment === "external" &&
        !s.units.some(
          (v) =>
            v.id !== u.id &&
            v.target === b.id &&
            ["contact", "wrap", "ingest"].includes(v.action),
        ),
    );
    let target = candidates.find((b) => b.id === u.priority);
    if (u.priority && !target) {
      u.priority = undefined;
      event(s, "invalid-target", "指定目標已離場 → 恢復自主", u.id);
    }
    target ??= candidates.find((b) => b.id === u.target);
    target ??= candidates
      .sort((a, b) => distance(u, a) - distance(u, b))
      .find((b) => distance(u, b) < (u.kind === "dendritic" ? 280 : 240));
    if (target) {
      u.target = target.id;
      const d = distance(u, target);
      if (d <= 34) {
        setAction(s, u, "contact", 5);
        event(
          s,
          "contact",
          "接觸病原：檢查莢膜與調理狀態",
          u.id,
          target.id,
          target,
        );
      } else {
        setAction(s, u, "approach");
        move(u, target, u.kind === "neutrophil" ? 4.2 : 2.5, c);
      }
    } else if (u.kind === "neutrophil") {
      const around = [
        { x: u.x + 35, y: u.y },
        { x: u.x - 35, y: u.y },
        { x: u.x, y: u.y + 35 },
        { x: u.x, y: u.y - 35 },
      ];
      const best = around.sort((a, b) => sample(s, b, c) - sample(s, a, c))[0];
      if (sample(s, best, c) > 0.015) {
        setAction(s, u, "chemotaxis");
        move(u, best, 3.6, c);
      } else {
        setAction(s, u, "patrol");
        move(
          u,
          { x: 500 + Math.sin(s.step * 0.004 + u.id.length) * 120, y: 300 },
          1.2,
          c,
        );
      }
    } else {
      setAction(s, u, "patrol");
      const id = Number(u.id.slice(1));
      move(
        u,
        {
          x: 470 + Math.sin(s.step * 0.003 + id) * 140,
          y: 300 + Math.cos(s.step * 0.002 + id) * 100,
        },
        0.65,
        c,
      );
    }
  }
}
export function step(s: State, commands: Command[] = [], c: Scenario = M1) {
  if (s.result) return s;
  s.step++;
  commands
    .filter((cmd) => cmd.step <= s.step)
    .forEach((cmd) => commit(s, cmd, c));
  field(s, c);
  advanceNode(s, c);
  recruit(s, c);
  ai(s, c);
  if (c.sourceSteps.includes(s.step)) {
    const p = c.foci[Math.floor(random(s) * c.foci.length)];
    spawn(s, { x: p.x + random(s) * 35, y: p.y + random(s) * 35 }, 4);
    event(
      s,
      "source",
      "呼吸道侵入口持續播散 → 新感染灶",
      undefined,
      undefined,
      p,
    );
  }
  if (!s.sourceClosed && s.step >= c.sourceClose) {
    s.sourceClosed = true;
    event(s, "source-closed", "局部屏障恢復，呼吸道來源已控制；仍須清除活病原");
  }
  for (const b of [...s.pathogens]) {
    if (b.load <= 0 || b.compartment === "internal") continue;
    if (
      s.node.phase === "active" &&
      b.antigen === s.node.antigen &&
      b.opsonin !== "antibody"
    ) {
      b.opsonin = "antibody";
      b.opsAt = s.step;
      event(
        s,
        "opsonize",
        "新生蛋白靶向抗體沉積 → 促進調理",
        undefined,
        b.id,
        b,
      );
    }
    const held = s.units.some(
      (u) => u.target === b.id && ["contact", "wrap"].includes(u.action),
    );
    if (!held) {
      move(
        b,
        {
          x: b.x + Math.cos(b.heading) * 10,
          y: b.y + Math.sin(b.heading) * 10,
        },
        0.13,
        c,
      );
      if (b.x < 50 || b.x > c.width - 50 || b.y < 50 || b.y > c.height - 50)
        b.heading += Math.PI;
    }
    if (s.step % c.growthEvery === 0 && !held) {
      b.load *= c.growth;
      if (b.load > c.split) {
        b.load /= 2;
        const child = spawn(
          s,
          {
            x: clamp(b.x + Math.cos(b.heading) * 48, 40, c.width - 40),
            y: clamp(b.y + Math.sin(b.heading) * 48, 40, c.tissueBottom),
          },
          b.load,
        );
        child.opsonin = b.opsonin;
        child.opsAt = b.opsAt;
        event(
          s,
          "split",
          "菌群繁殖並分出 → 空間擴散",
          undefined,
          child.id,
          child,
        );
      }
    }
  }
  s.pathogens = s.pathogens.filter((b) => b.load > 0);
  const load = s.pathogens.reduce((n, b) => n + b.load, 0),
    p = load * c.tissueDamage * c.dt;
  const inf = Math.max(0, s.inflammation - 42) * c.inflammationDamage * c.dt;
  const by =
    s.policy === "intense"
      ? s.units.filter((u) => u.kind === "neutrophil" && u.action !== "exit")
          .length *
        0.003 *
        c.dt
      : 0;
  s.damage.pathogen += p;
  s.damage.inflammation += inf;
  s.damage.bystander += by;
  s.tissue = clamp(s.tissue - p - inf - by, 0, 100);
  if (s.step % 100 === 0 && (p > 0 || inf > 0))
    event(
      s,
      "damage",
      `組織損傷：病原 ${s.damage.pathogen.toFixed(1)}／過炎 ${s.damage.inflammation.toFixed(1)}／旁觀者 ${s.damage.bystander.toFixed(1)}`,
    );
  s.resources = clamp(s.resources + c.regen * c.dt, 0, 150);
  s.supply = clamp(s.supply + c.supplyRegen * c.dt, 0, 12);
  // Failure wins ties. Future infection sources and internal viable load block victory.
  if (s.tissue <= 0 || s.step >= c.timeLimit)
    s.result = {
      outcome: "lost",
      reason: s.tissue <= 0 ? "必要肺組織功能崩潰" : "時間窗結束，仍未控制感染",
      stars: 0,
      step: s.step,
    };
  else if (
    s.sourceClosed &&
    s.pathogens.length === 0 &&
    c.sourceSteps.every((n) => n <= s.step)
  )
    s.result = {
      outcome: "won",
      reason: "來源已控制，胞外／胞內活病原均已清除",
      stars: s.tissue >= c.stars[1] ? 3 : s.tissue >= c.stars[0] ? 2 : 1,
      step: s.step,
    };
  if (s.result) event(s, "result", s.result.reason);
  return s;
}
