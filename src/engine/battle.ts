import type {
  BattleState,
  Command,
  Content,
  Resolution,
  Frame,
  BattleEvent,
  Population,
  Unit,
} from "../domain/model";
export const clone = <T>(v: T): T => structuredClone(v);
export function createBattle(
  scenarioId: string,
  seed: number,
  c: Content,
): BattleState {
  const s = c.scenarios[scenarioId];
  if (!s) throw new Error("未知關卡");
  const rng = seed >>> 0 || 1;
  const configs = [s.initialLoads, ...s.variants];
  const loads = configs[rng % configs.length];
  return {
    scenario: scenarioId,
    seed: rng,
    rng,
    turn: 1,
    ap: s.ap,
    opsonins: s.opsonins,
    regions: Object.fromEntries(s.regions.map((r) => [r.id, r.maxHealth])),
    units: s.initialUnits.map((u, i) => ({
      ...u,
      id: `u${i + 1}`,
      used: false,
    })),
    populations: s.regions.map((r, i) => ({
      id: `p${i + 1}`,
      pathogen: s.pathogen,
      region: r.id,
      load: loads[i],
      compartment: "extracellular",
      opsonin: 0,
    })),
    recruits: [],
    nextId: 10,
    eventSeq: 0,
  };
}
export function occupancy(b: BattleState, region: string) {
  return (
    b.units.filter((u) => u.region === region).length +
    b.recruits.filter((r) => r.region === region).length
  );
}
export function preservation(b: BattleState, c: Content) {
  const rs = c.scenarios[b.scenario].regions;
  return Math.round(
    (rs.reduce((a, r) => a + (b.regions[r.id] / r.maxHealth) * r.weight, 0) /
      rs.reduce((a, r) => a + r.weight, 0)) *
      100,
  );
}
export function power(u: Unit, p: Population, c: Content) {
  const d = c.cells[u.kind];
  return p.opsonin > 0 ? d.power : d.unmarkedPower;
}
export function validateCommand(
  b: BattleState,
  cmd: Command,
  c: Content,
): string | undefined {
  const s = c.scenarios[b.scenario];
  if (b.outcome) return "此局已結算，請重試或返回選關。";
  if (cmd.type === "endTurn") return;
  const cost =
    cmd.type === "recruit"
      ? c.cells[cmd.kind]?.cost
      : cmd.type === "engulf"
        ? 2
        : cmd.type === "priority"
          ? 0
          : 1;
  if (cost === undefined) return "未知細胞類型。";
  if (b.ap < cost) return `行動點不足：需要 ${cost} AP，目前 ${b.ap} AP。`;
  if (cmd.type === "recruit" || cmd.type === "move") {
    const r = s.regions.find((r) => r.id === cmd.region);
    if (!r) return "目的區域不存在。";
    if (b.regions[r.id] <= 0) return "目的區已失守，無法調度或招募。";
    if (occupancy(b, r.id) >= r.capacity)
      return "區域容量已滿（包含增援預留），請先調度。";
    if (cmd.type === "recruit" && !s.pool.includes(cmd.kind))
      return "此案例無法招募這種細胞。";
  }
  if ("unitId" in cmd) {
    const u = b.units.find((u) => u.id === cmd.unitId);
    if (!u) return "單位不存在。";
    if (cmd.type === "move") {
      if (
        !s.regions
          .find((r) => r.id === u.region)
          ?.neighbors.includes(cmd.region)
      )
        return "只能調度至相鄰區域。";
    } else {
      const p = b.populations.find((p) => p.id === cmd.targetId);
      if (
        !p ||
        p.load <= 0 ||
        p.region !== u.region ||
        p.compartment !== "extracellular"
      )
        return "需選取同區域仍存活的胞外病原。";
      if (cmd.type === "engulf" && u.used)
        return "此單位本回合已使用主要作用；不會再自動吞噬。";
    }
  }
  if (cmd.type === "opsonize") {
    const p = b.populations.find((p) => p.id === cmd.targetId);
    if (
      !p ||
      p.load <= 0 ||
      p.compartment !== "extracellular" ||
      p.pathogen !== s.pathogen
    )
      return "需選取本案例的胞外病原。";
    if (b.opsonins <= 0) return "本案例既存調理支援已用盡。";
    if (p.opsonin > 0) return "此群體仍有調理標記，無須重複施加。";
  }
}
export function resolveCommand(
  before: BattleState,
  cmd: Command,
  c: Content,
): Resolution {
  const error = validateCommand(before, cmd, c);
  if (error) return { state: before, frames: [], error };
  const b = clone(before),
    frames: Frame[] = [];
  const s = c.scenarios[b.scenario];
  let phase: BattleEvent["phase"] = "command";
  const emit = (
    type: BattleEvent["type"],
    reason: string,
    fields: Partial<BattleEvent> = {},
  ) => {
    const event: BattleEvent = {
      id: `e${++b.eventSeq}`,
      turn: b.turn,
      phase,
      type,
      reason,
      ...fields,
    };
    frames.push({ event, state: clone(b) });
  };
  const engulf = (u: Unit, p: Population) => {
    const n = Math.min(p.load, power(u, p, c));
    const def = c.pathogens[p.pathogen];
    u.used = true;
    p.load -= n;
    let internal: Population | undefined;
    if (def.survivesEngulfment) {
      internal = b.populations.find(
        (v) => v.hostId === u.id && v.pathogen === p.pathogen,
      );
      if (internal) internal.load += n;
      else {
        internal = {
          id: `p${b.nextId++}`,
          pathogen: p.pathogen,
          region: u.region,
          load: n,
          compartment: "phagosome",
          hostId: u.id,
          opsonin: 0,
        };
        b.populations.push(internal);
      }
    }
    emit(
      "PathogenEngulfed",
      `${c.cells[u.kind].name}吞入 ${n} 負荷${p.opsonin ? "（調理提高辨識效率）" : "（未調理，莢膜限制吞噬）"}。`,
      {
        source: u.id,
        target: p.id,
        region: u.region,
        amount: n,
        data: {
          result: def.survivesEngulfment ? "survived" : "cleared",
          hostId: u.id,
        },
      },
    );
    if (def.survivesEngulfment)
      emit(
        "IntracellularSurvival",
        `吞入不等於清除：${n} 負荷在吞噬囊泡內存活。`,
        { source: u.id, target: internal!.id, region: u.region, amount: n },
      );
    else
      emit("PathogenCleared", `已清除 ${n} 負荷；吞噬後未保留活感染來源。`, {
        source: u.id,
        target: p.id,
        region: u.region,
        amount: n,
      });
  };
  if (cmd.type === "move") {
    const u = b.units.find((u) => u.id === cmd.unitId)!;
    const from = u.region;
    b.ap--;
    u.region = cmd.region;
    for (const p of b.populations.filter((p) => p.hostId === u.id))
      p.region = cmd.region;
    emit(
      "UnitMoved",
      `${c.cells[u.kind].name}由${s.regions.find((r) => r.id === from)!.name}調往${s.regions.find((r) => r.id === u.region)!.name}。`,
      { source: u.id, region: u.region, data: { from, to: u.region } },
    );
  } else if (cmd.type === "opsonize") {
    const p = b.populations.find((p) => p.id === cmd.targetId)!;
    b.ap--;
    b.opsonins--;
    p.opsonin = s.opsoninDuration;
    emit(
      "OpsoninApplied",
      `既存特異性抗體與補體附著：持續 ${s.opsoninDuration} 次結算；此行動不直接減少負荷。`,
      {
        target: p.id,
        region: p.region,
        data: {
          antigen: c.pathogens[p.pathogen].antigen,
          duration: s.opsoninDuration,
        },
      },
    );
  } else if (cmd.type === "engulf") {
    b.ap -= 2;
    engulf(
      b.units.find((u) => u.id === cmd.unitId)!,
      b.populations.find((p) => p.id === cmd.targetId)!,
    );
  } else if (cmd.type === "priority") {
    const u = b.units.find((u) => u.id === cmd.unitId)!;
    u.priority = cmd.targetId;
    emit(
      "PriorityChanged",
      "優先目標已指定；若目標失效，自動改選同區負荷最高的胞外群體。",
      { source: u.id, target: cmd.targetId, region: u.region },
    );
  } else if (cmd.type === "recruit") {
    const d = c.cells[cmd.kind];
    b.ap -= d.cost;
    const r = {
      id: `q${b.nextId++}`,
      kind: cmd.kind,
      region: cmd.region,
      remaining: d.delay,
    };
    b.recruits.push(r);
    emit(
      "RecruitmentRequested",
      `${d.name}增援已預約，預留 1 容量；${d.delay} 次回合結算後抵達。`,
      {
        source: r.id,
        region: r.region,
        data: { kind: r.kind, remaining: r.remaining },
      },
    );
  } else {
    phase = "cells";
    for (const u of [...b.units].sort((a, z) => a.id.localeCompare(z.id))) {
      if (u.used) continue;
      const targets = b.populations
        .filter(
          (p) =>
            p.region === u.region &&
            p.compartment === "extracellular" &&
            p.load > 0,
        )
        .sort((a, z) => z.load - a.load || a.id.localeCompare(z.id));
      const p = targets.find((p) => p.id === u.priority) || targets[0];
      if (p) {
        if (u.priority && p.id !== u.priority)
          emit("PriorityFallback", "原優先目標已失效，依負荷與穩定 ID 改選。", {
            source: u.id,
            target: p.id,
            region: u.region,
          });
        engulf(u, p);
      }
    }
    phase = "pathogens";
    for (const p of [...b.populations].filter((p) => p.load > 0)) {
      const d = c.pathogens[p.pathogen];
      const n =
        p.compartment === "extracellular"
          ? d.replication
          : d.intracellularGrowth;
      if (n > 0) {
        p.load += n;
        emit(
          "PathogenReplicated",
          `${d.name}${p.compartment === "extracellular" ? "胞外" : "胞內"}繁殖 +${n} 負荷。`,
          { source: p.id, target: p.id, region: p.region, amount: n },
        );
      }
    }
    const spread = b.populations.filter(
      (p) => p.compartment === "extracellular" && p.load >= s.spreadThreshold,
    );
    for (const p of spread) {
      const rs = s.regions
        .find((r) => r.id === p.region)!
        .neighbors.filter((id) => b.regions[id] > 0);
      if (!rs.length) continue;
      b.rng = (Math.imul(b.rng, 1664525) + 1013904223) >>> 0;
      const to = rs[b.rng % rs.length];
      let dest = b.populations.find(
        (v) =>
          v.region === to &&
          v.pathogen === p.pathogen &&
          v.compartment === "extracellular" &&
          v.opsonin === 0,
      );
      p.load--;
      if (dest) dest.load++;
      else {
        dest = { ...p, id: `p${b.nextId++}`, region: to, load: 1, opsonin: 0 };
        b.populations.push(dest);
      }
      emit(
        "PathogenSpread",
        "高負荷群體沿相鄰組織擴散 1 負荷；擴散不攜帶局部調理標記。",
        {
          source: p.id,
          target: dest.id,
          region: to,
          amount: 1,
          data: { from: p.region, to },
        },
      );
    }
    phase = "tissue";
    for (const r of s.regions) {
      const load = b.populations
        .filter((p) => p.region === r.id)
        .reduce((v, p) => v + p.load, 0);
      const damage = Math.min(b.regions[r.id], load * s.damagePerLoad);
      if (damage) {
        b.regions[r.id] -= damage;
        emit(
          "TissueDamaged",
          `${r.name}殘餘感染 ${load} → 組織損傷 ${damage}。`,
          { region: r.id, amount: damage, data: { load } },
        );
      }
    }
    phase = "waiting";
    for (const r of [...b.recruits]) {
      if (b.regions[r.region] <= 0) {
        emit(
          "RecruitmentWaiting",
          "目的區失守：保留增援與容量預約，等待安全目的區；可在本局失敗後重試。",
          { source: r.id, region: r.region },
        );
        continue;
      }
      r.remaining--;
      if (r.remaining <= 0) {
        b.recruits = b.recruits.filter((v) => v.id !== r.id);
        const u = {
          id: `u${b.nextId++}`,
          kind: r.kind,
          region: r.region,
          used: false,
        };
        b.units.push(u);
        emit(
          "UnitArrived",
          `${c.cells[r.kind].name}由血液入口抵達，下個指揮階段可用。`,
          { source: u.id, region: r.region, data: { kind: r.kind } },
        );
      } else
        emit("RecruitmentWaiting", `增援尚需 ${r.remaining} 次結算。`, {
          source: r.id,
          region: r.region,
          data: { remaining: r.remaining },
        });
    }
    for (const p of b.populations)
      if (p.opsonin > 0) {
        p.opsonin--;
        if (p.opsonin === 0 && p.load > 0)
          emit(
            "OpsoninExpired",
            "局部調理標記已到期；仍存活群體恢復未調理效率。",
            { target: p.id, region: p.region },
          );
      }
    b.populations = b.populations.filter((p) => p.load > 0);
    phase = "result";
    const preserved = preservation(b, c),
      total = b.populations.reduce((v, p) => v + p.load, 0);
    const failed = s.regions.some((r) => b.regions[r.id] <= 0);
    const success =
      s.mode === "clearance" ? total === 0 : total <= (s.controlThreshold ?? 0);
    if (failed || success || b.turn >= s.maxTurns) {
      const victory = !failed && success;
      b.outcome = {
        type: victory ? "victory" : "defeat",
        reason: failed
          ? "必要組織區域失守"
          : victory
            ? s.mode === "clearance"
              ? "此情境的感染來源已清除"
              : "此情境的感染控制目標已達成"
            : "未能在防禦時限內控制感染",
        preservation: preserved,
        stars: victory
          ? preserved >= s.stars[0]
            ? 3
            : preserved >= s.stars[1]
              ? 2
              : 1
          : 0,
        turn: b.turn,
      };
      emit("BattleEnded", b.outcome.reason, {
        data: {
          result: b.outcome.type,
          stars: b.outcome.stars,
          preservation: preserved,
        },
      });
    } else {
      b.turn++;
      b.ap = s.ap;
      for (const u of b.units) u.used = false;
      emit(
        "TurnEnded",
        `進入回合 ${b.turn}：行動點補至 ${s.ap}，在場單位主要作用恢復。`,
      );
    }
  }
  return { state: b, frames };
}
export const resolveEndTurn = (b: BattleState, c: Content) =>
  resolveCommand(b, { type: "endTurn" }, c);

export interface CommandOption {
  command: Command;
  cost: number;
  reason?: string;
}
/** Enumerates available actions without consuming RNG or mutating the battle. */
export function getAvailableCommands(
  b: BattleState,
  actorId: string,
  c: Content,
): CommandOption[] {
  const u = b.units.find((u) => u.id === actorId);
  if (!u) return [];
  const s = c.scenarios[b.scenario];
  const commands: Command[] = [
    ...s.regions
      .find((r) => r.id === u.region)!
      .neighbors.map((region) => ({
        type: "move" as const,
        unitId: u.id,
        region,
      })),
    ...b.populations
      .filter(
        (p) =>
          p.region === u.region &&
          p.compartment === "extracellular" &&
          p.load > 0,
      )
      .flatMap((p) => [
        { type: "engulf" as const, unitId: u.id, targetId: p.id },
        { type: "priority" as const, unitId: u.id, targetId: p.id },
      ]),
  ];
  return commands.map((command) => ({
    command,
    cost: command.type === "engulf" ? 2 : command.type === "move" ? 1 : 0,
    reason: validateCommand(b, command, c),
  }));
}
