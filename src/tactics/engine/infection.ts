import { intracellularControl } from "./intracellularControl";
import type {
  Cell,
  Colony,
  HostCell,
  TacticalContent,
  TacticalState,
} from "../domain/model";
import { emit } from "./events";
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export const viral = (c: TacticalContent) =>
  c.mechanics === "viral" || c.mechanics === "retroviral";
export function initialCampaign(s: TacticalState, c: TacticalContent) {
  if (!c.mechanics) return;
  s.campaign = {
    containment: Object.fromEntries(c.fields.map((f) => [f.id, 0])),
    barrier: Object.fromEntries(c.fields.map((f) => [f.id, 0])),
    stable: 0,
    cd4: 100,
    impairment: 0,
  };
  if (c.mechanics === "containment") {
    const host = s.cells.find((u) => u.kind === "macrophage")!;
    host.replicateAt = s.tick + c.lifecycle!.intracellular!.every;
    const id = `i${s.serial++}`;
    s.internal.push({
      id,
      host: host.id,
      pathogen: c.pathogen.id,
      load: 6,
      compartment: "phagosome",
      stage: "persistent",
      clearAt: 0,
    });
    emit(
      s,
      "survive",
      host.position,
      "開場已有感染巨噬細胞：含菌囊泡內保留活菌；清掉胞外來源仍需控制此感染焦點。",
      6,
      { actor: host.id, target: id, survives: true },
    );
  }
  if (c.mechanics === "retroviral") {
    // Reservoir exists from the start: it is never synthesized by the ending script.
    const hosts = s.hosts.filter((h) => h.kind === "cd4host");
    for (const [i, h] of hosts.slice(0, 3).entries())
      infect(s, h, c, i === 0 ? "latent" : "eclipse");
  }
}
function infect(
  s: TacticalState,
  h: HostCell,
  c: TacticalContent,
  phase: "eclipse" | "latent" = "eclipse",
  from?: { x: number; z: number },
) {
  h.infection = {
    pathogen: c.pathogen.id,
    compartment: "nucleus",
    phase,
    since: s.tick,
    cycles: 0,
  };
  h.load = 1;
  h.antigen = "self";
  h.stressed = false;
  h.mhc1 = true;
  emit(
    s,
    "infect",
    h.position,
    phase === "latent"
      ? "病毒基因組整合並潛伏；目前無病毒肽供 CD8 辨識，並非已清除。"
      : `${c.pathogen.name}進入易感宿主，胞內感染建立中；抗體不能進入清除。`,
    1,
    { target: h.id, ...(from ? { from: { ...from } } : {}) },
  );
}
function release(
  s: TacticalState,
  c: TacticalContent,
  region: string,
  position: { x: number; z: number },
  n: number,
  from?: { x: number; z: number },
) {
  let p = s.colonies.find(
    (p) => p.region === region && dist(p.position, position) < 3,
  );
  if (p) p.load += n;
  else {
    p = {
      id: `p${s.serial++}`,
      region,
      position: { ...position },
      load: n,
      markedUntil: 0,
      complementUntil: 0,
      antibodyUntil: 0,
      pathogen: c.pathogen.id,
    };
    s.colonies.push(p);
  }
  emit(
    s,
    "release",
    position,
    `${n} 胞外感染負荷由胞內來源釋出；胞內外分開追蹤。`,
    n,
    { target: p.id, from },
  );
}
export function intracellularStep(s: TacticalState, c: TacticalContent) {
  const config = c.lifecycle?.intracellular;
  if (!config) return;
  for (const u of [...s.cells]) {
    const cargo = s.internal.filter(
      (p) => p.host === u.id && p.stage === "persistent" && p.load > 0,
    );
    if (!cargo.length) {
      delete u.replicateAt;
      continue;
    }
    u.replicateAt ??= s.tick + config.every;
    if (s.tick < u.replicateAt) continue;
    u.replicateAt = s.tick + config.every;
    const total = cargo.reduce((n, p) => n + p.load, 0);
    const { controlled } = intracellularControl(s, u, c);
    if (!controlled) {
      const n = Math.max(1, Math.ceil(total * config.fraction));
      cargo[0].load += n;
      emit(
        s,
        "grow",
        u.position,
        `${c.pathogen.name}在巨噬含菌囊泡內增殖 +${n}（${total}→${total + n}）；需局部 IFN-γ 支援${c.mechanics === "containment" ? "與圍堵" : ""}，胞外調理不能進入囊泡。`,
        n,
        { actor: u.id, target: cargo[0].id },
      );
    } else {
      emit(
        s,
        "contain",
        u.position,
        "局部巨噬活化／圍堵抑制胞內增殖；仍存活的菌量不等於已清除。",
        total,
        { actor: u.id },
      );
    }
    if (cargo.reduce((n, p) => n + p.load, 0) >= config.ruptureAt) {
      // Overloaded infected host ruptures. Transfer viable cargo, never duplicate or clear it.
      const viable = s.internal
        .filter((p) => p.host === u.id)
        .reduce((n, p) => n + p.load, 0);
      s.internal = s.internal.filter((p) => p.host !== u.id);
      s.cells = s.cells.filter((x) => x.id !== u.id);
      s.health[u.region] = Math.max(0, s.health[u.region] - 5);
      emit(
        s,
        "damage",
        u.position,
        `${c.cells[u.kind].name}感染失控而破裂，活菌重返胞外；原宿主失去，組織受損 5%。`,
        5,
        { actor: u.id },
      );
      release(s, c, u.region, u.position, viable, u.position);
    }
  }
}
export function campaignStep(s: TacticalState, c: TacticalContent) {
  if (!s.campaign || !c.mechanics) return;
  const q = s.campaign;
  if (s.tick % 5 === 0)
    for (const f of c.fields) {
      const signal = s.immunity.signals[f.id];
      signal.ifni = Math.max(0, signal.ifni - 4);
      signal.il17 = Math.max(0, signal.il17 - 4);
      signal.il22 = Math.max(0, signal.il22 - 4);
      for (const u of s.cells.filter(
        (u) => dist(u.position, f.center) < f.radius + 1,
      )) {
        if (
          u.kind === "pdc" &&
          (s.colonies.some((p) => p.region === f.id) ||
            s.hosts.some(
              (h) =>
                h.region === f.id &&
                h.load > 0 &&
                h.infection?.phase !== "latent",
            ))
        )
          signal.ifni = Math.min(100, signal.ifni + 22);
        if (
          u.kind === "ilc3" ||
          (u.kind === "th17" && u.activation === "effector")
        ) {
          signal.il17 = Math.min(100, signal.il17 + 18);
          signal.il22 = Math.min(100, signal.il22 + 16);
          signal.cxcl8 = Math.min(100, signal.cxcl8 + 10);
        }
      }
      if (
        viral(c) &&
        s.hosts.some(
          (h) => h.region === f.id && h.infection?.phase === "productive",
        )
      )
        signal.ifni = Math.min(100, signal.ifni + 6);
      q.barrier[f.id] = Math.min(
        100,
        ((signal.il17 * 0.65 + signal.il22 * 0.35) * s.health[f.id]) / 100,
      );
      if (c.mechanics === "fungal" && s.tick % 50 === 0 && q.barrier[f.id] > 30)
        emit(
          s,
          "barrier",
          f.center,
          "IL-17／IL-22 作用於上皮：提高抗菌肽、屏障與募集；不是直接傷害技能。",
          Math.round(q.barrier[f.id]),
        );
    }
  intracellularStep(s, c);
  if (c.mechanics === "containment") {
    for (const f of c.fields) {
      const infected = s.cells.filter(
        (u) =>
          u.kind === "macrophage" &&
          s.internal.some((p) => p.host === u.id && p.stage === "persistent"),
      );
      const focus = infected.filter((u) => u.region === f.id);
      const helpers = s.cells.filter(
        (u) =>
          (u.kind === "th1" || u.kind === "helperT") &&
          u.activation === "effector" &&
          u.antigen === (c.pathogen.antigen ?? `${c.pathogen.id}:protein`) &&
          focus.some((m) => dist(u.position, m.position) < 6),
      );
      const active =
        focus.length > 0 &&
        helpers.length > 0 &&
        s.immunity.signals[f.id].ifng >= 20;
      q.containment[f.id] = Math.max(
        0,
        Math.min(100, q.containment[f.id] + (active ? 0.65 : -0.3)),
      );
    }
    const burden =
      s.colonies.reduce((n, p) => n + p.load, 0) +
      s.internal.reduce((n, p) => n + p.load, 0);
    const regions = new Set([
      ...s.colonies.map((p) => p.region),
      ...s.internal.map((p) => s.cells.find((u) => u.id === p.host)!.region),
    ]);
    const stable =
      burden <= 25 &&
      [...regions].every((id) => q.containment[id] >= 60) &&
      Object.values(s.health).every((h) => h >= 45) &&
      s.wave === c.waves.length - 1;
    q.stable = stable ? q.stable + 1 : 0;
    if (s.tick % 50 === 0 && Object.values(q.containment).some((n) => n > 0))
      emit(
        s,
        "contain",
        c.fields[0].center,
        `感染圍堵：穩定 ${Math.round(q.stable * 0.2)}/20 秒；保留活菌、降低播散並非臨床治癒。`,
        q.stable,
      );
  }
  if (c.mechanics === "fungal" && s.tick % 50 === 0)
    for (const p of s.colonies) {
      if (p.load >= 5 && q.barrier[p.region] < 35 && p.form !== "hypha") {
        p.form = "hypha";
        emit(
          s,
          "grow",
          p.position,
          "酵母轉為侵襲性菌絲；長菌絲不能整條吞入，需嗜中性球顆粒與上皮防禦。",
          p.load,
          { target: p.id },
        );
      }
      if (q.barrier[p.region] >= 40) {
        p.load = Math.max(0, p.load - 1);
        emit(
          s,
          "barrier",
          p.position,
          "上皮抗菌肽限制表面真菌，負荷減少；IL-17 的效應經由組織。",
          1,
          { target: p.id },
        );
      }
      if (p.form === "hypha")
        s.health[p.region] = Math.max(
          0,
          s.health[p.region] -
            0.35 * Math.max(0, 1 - q.barrier[p.region] / 100),
        );
    }
  if (viral(c)) {
    // Virions do not reproduce outside cells. Antibody neutralizes only extracellular virions.
    if (s.tick % 15 === 0)
      for (const p of s.colonies) {
        if ((p.antibodyUntil ?? 0) > s.tick) {
          const n = Math.min(3, p.load);
          p.load -= n;
          emit(
            s,
            "clear",
            p.position,
            "抗體阻斷胞外病毒與宿主受體結合；不消除胞內病毒。",
            n,
            { target: p.id },
          );
        }
        if (p.load <= 0) continue;
        const protection = s.immunity.signals[p.region].ifni;
        if (protection >= 70 && s.tick % 45 !== 0) continue;
        const h = s.hosts
          .filter(
            (h) =>
              h.region === p.region &&
              h.health > 0 &&
              !h.infection &&
              !h.apoptoticAt &&
              (c.mechanics === "retroviral"
                ? h.kind === "cd4host"
                : h.layer === "epithelium"),
          )
          .sort(
            (a, b) =>
              dist(a.position, p.position) - dist(b.position, p.position),
          )[0];
        if (h) {
          p.load--;
          infect(
            s,
            h,
            c,
            c.mechanics === "retroviral" &&
              (s.tick + Number(h.id.slice(1))) % 4 === 0
              ? "latent"
              : "eclipse",
            p.position,
          );
        }
      }
    for (const h of s.hosts.filter((h) => h.load > 0 && !h.apoptoticAt)) {
      if (s.health[h.region] <= 0) {
        h.apoptoticAt = s.tick;
        h.load = 0;
        continue;
      }
      const infection = h.infection;
      if (!infection) continue;
      if (infection.phase === "latent") {
        // Deterministic low-frequency reactivation, independent of playback and ending.
        if (
          s.tick - (infection.since ?? 0) > 300 &&
          (s.tick + Number(h.id.slice(1)) * 7) % 520 === 0
        ) {
          infection.phase = "productive";
          infection.since = s.tick;
          h.antigen = c.pathogen.antigen!;
          h.stressed = true;
          h.mhc1 = Number(h.id.slice(1)) % 3 !== 0;
          infection.cycles = 0;
          emit(
            s,
            "activate",
            h.position,
            "潛伏宿主再活化，開始表達病毒肽並產毒；潛伏庫未被清除。",
            1,
            { target: h.id },
          );
        }
        continue;
      }
      if (
        infection.phase === "eclipse" &&
        s.tick - (infection.since ?? 0) >= (c.lifecycle?.virus?.eclipse ?? 35)
      ) {
        infection.phase = "productive";
        infection.since = s.tick;
        infection.cycles = 0;
        h.antigen = c.pathogen.antigen!;
        h.stressed = true;
        h.mhc1 = Number(h.id.slice(1)) % 3 !== 0;
        emit(
          s,
          "present",
          h.position,
          h.mhc1
            ? "感染宿主呈遞病毒肽／MHC-I：只有相符、已活化 CD8 可辨識。"
            : "此受壓宿主 MHC-I 降低，NK 可辨識；不是所有感染細胞都相同。",
          1,
          { target: h.id },
        );
      }
      if (
        infection.phase === "productive" &&
        s.tick - (infection.since ?? s.tick) >=
          (c.lifecycle?.virus?.every ?? 40)
      ) {
        infection.since = s.tick;
        infection.cycles = (infection.cycles ?? 0) + 1;
        const n = s.immunity.signals[h.region].ifni >= 35 ? 1 : 3;
        release(
          s,
          c,
          h.region,
          { x: h.position.x * 0.85, z: h.position.z * 0.85 },
          n,
          h.position,
        );
        s.health[h.region] = Math.max(
          0,
          s.health[h.region] - (c.mechanics === "viral" ? 0.4 : 0.15),
        );
        if (infection.cycles >= (c.lifecycle?.virus?.lifespan ?? 4)) {
          h.load = 0;
          h.apoptoticAt = s.tick;
          s.health[h.region] = Math.max(0, s.health[h.region] - 2);
          emit(
            s,
            "clear",
            h.position,
            "產毒宿主因感染相關細胞死亡而停止產毒；已釋出的病毒仍在胞外，宿主損失不能被當作無代價清除。",
            1,
            { target: h.id },
          );
        }
      }
    }
    if (c.mechanics === "retroviral") {
      const susceptible = s.hosts.filter((h) => h.kind === "cd4host");
      // Latent infection is not synonymous with a dead/nonfunctional CD4 cell.
      // Weights represent population-level support, not measured clinical percentages.
      const functional = susceptible.reduce(
        (n, h) =>
          n +
          (h.health <= 0 || h.apoptoticAt
            ? 0
            : !h.infection
              ? 1
              : h.infection.phase === "latent"
                ? 0.8
                : h.infection.phase === "eclipse"
                  ? 0.5
                  : 0),
        0,
      );
      // Untreated chronic impairment accumulates continuously, not as a final scripted wipe.
      const burden = s.colonies.reduce((n, p) => n + p.load, 0);
      const productive = susceptible.filter(
        (h) => h.infection?.phase === "productive" && h.load > 0,
      ).length;
      q.impairment = Math.min(
        100,
        q.impairment + burden * 0.0003 + productive * 0.001,
      );
      const impairment = q.impairment;
      q.cd4 = Math.max(
        0,
        (100 * functional) / Math.max(1, susceptible.length) - impairment,
      );
      if (s.tick % c.damageEvery === 0) {
        // Aggregate immune-support failure, not direct HIV infection of stromal cells.
        const injury = (1 - q.cd4 / 100) * 0.55;
        for (const f of c.fields)
          s.health[f.id] = Math.max(0, s.health[f.id] - injury);
      }
      if (s.tick % 100 === 0)
        emit(
          s,
          "damage",
          c.fields[0].center,
          `功能性 CD4 支援 ${Math.round(q.cd4)}%；支援不足增加局部組織耗損（教學抽象），不代表 HIV 直接感染基質。`,
          Math.round(q.cd4),
        );
    }
  }
  s.colonies = s.colonies.filter((p) => p.load > 0);
}
export function phagosomeSurvives(c: TacticalContent, cell: Cell) {
  return c.pathogen.survives && cell.kind === "macrophage";
}
export function canIngest(p: Colony, cell: Cell) {
  return p.form !== "hypha" || cell.kind === "dendritic";
}
