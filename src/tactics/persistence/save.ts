import { DEPLOYMENT_BUDGET } from "../content/deployment";
import { victoryCondition, limitedCondition } from "../engine/goals";
import { coatings } from "../engine/opsonization";
import { populateTissue } from "../content/anatomy";
import { z } from "zod";
import type {
  TacticalContent,
  TacticalSave,
  TacticalState,
} from "../domain/model";
import { CELL_TYPES } from "../domain/model";
import { initialImmunity } from "../engine/immunity";
import { preservation } from "../engine/simulation";
import { tacticalScenarios } from "../content/m1";
import { entries } from "../../content/encyclopedia";
export const TACTICS_KEY = "immuminati:tactics:v2";
const num = (max = 100000) => z.number().finite().min(0).max(max);
const integer = (max = 100000) => num(max).int();
const id = z.string().min(1).max(50);
const vec = z
  .object({
    x: z.number().finite().min(-30).max(30),
    z: z.number().finite().min(-30).max(30),
  })
  .strict();
const kind = z.enum(CELL_TYPES);
const order = z.discriminatedUnion("type", [
  z.object({ type: z.literal("guard"), point: vec }).strict(),
  z.object({ type: z.literal("move"), point: vec }).strict(),
  z.object({ type: z.literal("attack"), target: id }).strict(),
]);
const result = z
  .object({
    type: z.enum(["victory", "defeat", "limited"]),
    reason: z.string().max(300),
    preservation: integer(100),
    stars: integer(3),
    seconds: num(3600),
  })
  .strict();
const battle = z
  .object({
    version: z.literal(2),
    preparation: z
      .object({
        remaining: integer(DEPLOYMENT_BUDGET),
        fixed: z.array(id).max(1),
      })
      .strict()
      .optional(),
    scenario: id,
    seed: integer(4294967295),
    rng: integer(4294967295),
    tick: integer(10000),
    energy: integer(20),
    support: integer(6),
    wave: integer(20),
    nextWaveAt: integer(100000),
    health: z.record(id, num(100)),
    cells: z
      .array(
        z
          .object({
            id,
            kind,
            position: vec,
            region: id,
            order,
            path: z.array(vec).max(10),
            readyAt: integer(10000),
            recognized: z.boolean().optional(),
            antigen: id.optional(),
            activation: z
              .enum(["resting", "activating", "effector"])
              .optional(),
            activationAt: integer(10000).optional(),
            partner: id.optional(),
            dockAt: integer(10000).optional(),
          })
          .strict(),
      )
      .max(1000),
    colonies: z
      .array(
        z
          .object({
            id,
            region: id,
            position: vec,
            load: integer(1000),
            markedUntil: integer(10000),
            form: z.enum(["yeast", "hypha"]).optional(),
            opsonin: z.enum(["c3b", "antibody"]).optional(),
            complementUntil: integer(10000).optional(),
            antibodyUntil: integer(10000).optional(),
            pathogen: id,
          })
          .strict(),
      )
      .max(200),
    arrivals: z
      .array(z.object({ id, kind, region: id, at: integer(10000) }).strict())
      .max(1000),
    internal: z
      .array(
        z
          .object({
            id,
            host: id,
            load: integer(1000),
            pathogen: id,
            compartment: z.enum(["phagosome", "cytosol"]).optional(),
            stage: z.enum(["processing", "persistent"]).optional(),
            clearAt: integer(10000).optional(),
          })
          .strict(),
      )
      .max(1000),
    immunity: z
      .object({
        autoSeek: z.boolean(),
        signals: z.record(
          id,
          z
            .object({
              cxcl8: num(100),
              il12: num(100),
              ifng: num(100),
              il10: num(100),
              inflammation: num(100),
              ifni: num(100).optional(),
              il17: num(100).optional(),
              il22: num(100).optional(),
            })
            .strict(),
        ),
        node: z
          .object({
            stage: z.enum(["idle", "migrating", "presenting", "primed"]),
            antigen: z.string().max(50),
            until: integer(10000),
            crossPresented: z.boolean().optional(),
          })
          .strict(),
        antibodies: num(100),
      })
      .strict()
      .optional(),
    hosts: z
      .array(
        z
          .object({
            id,
            region: id,
            position: vec,
            antigen: id,
            kind: z
              .enum([
                "alveolarI",
                "alveolarII",
                "endothelial",
                "mucosal",
                "enterocyte",
                "goblet",
                "cd4host",
                "stromal",
              ])
              .optional(),
            layer: z.enum(["epithelium", "vascular", "lymphoid"]).optional(),
            health: num(100).optional(),
            wall: z
              .object({ angle: num(7), radius: num(15), arc: num(2) })
              .strict()
              .optional(),
            infection: z
              .object({
                pathogen: id,
                compartment: z.enum(["cytosol", "nucleus"]),
                phase: z.enum(["eclipse", "productive", "latent"]).optional(),
                since: integer(10000).optional(),
              })
              .strict()
              .optional(),
            mhc1: z.boolean(),
            stressed: z.boolean(),
            load: integer(1000),
            apoptoticAt: integer(10000),
          })
          .strict(),
      )
      .max(200)
      .optional(),
    serial: integer(100000),
    eventId: integer(100000),
    events: z
      .array(
        z
          .object({
            id: integer(100000),
            tick: integer(10000),
            type: z.enum([
              "move",
              "engulf",
              "clear",
              "survive",
              "mark",
              "arrive",
              "request",
              "grow",
              "spread",
              "damage",
              "wave",
              "result",
              "recognize",
              "signal",
              "present",
              "activate",
              "antibody",
              "regulate",
              "cytotoxic",
              "dock",
              "infect",
              "release",
              "degranulate",
              "contain",
              "barrier",
            ]),
            actor: id.optional(),
            target: id.optional(),
            position: vec,
            from: vec.optional(),
            amount: num(10000),
            message: z.string().max(1000),
            survives: z.boolean().optional(),
            opsonin: z.enum(["c3b", "antibody"]).optional(),
          })
          .strict(),
      )
      .max(400),
    result: result.optional(),
    campaign: z
      .object({
        containment: z.record(id, num(100)),
        barrier: z.record(id, num(100)),
        stable: integer(10000),
        cd4: num(100),
        impairment: num(100),
      })
      .strict()
      .optional(),
  })
  .strict();
const schema = z
  .object({
    schema: z.literal(2),
    rules: z.enum(["2.0", "2.1", "2.2", "2.3", "2.4", "3.0", "3.1"]),
    content: z.enum([
      "m1-tactics.1",
      "m1-tactics.2",
      "m1-tactics.3",
      "m1-tactics.4",
      "m1-tactics.5",
      "campaign.1",
      "campaign.2",
    ]),
    state: battle,
    paused: z.boolean(),
    undo: z.array(battle).max(10),
    settings: z
      .object({
        speed: z.union([z.literal(1), z.literal(2)]),
        reduced: z.boolean(),
        idle: z.boolean(),
        hints: z.boolean(),
        labels: z.boolean().default(false),
      })
      .strict(),
    read: z.array(id).max(200),
    records: z.record(id, result),
    revealed: z.array(z.literal("m6")).max(1).default([]),
  })
  .strict();
function check(s: TacticalState, c: TacticalContent) {
  if (s.preparation) {
    const p = s.preparation;
    const fixed = s.cells.filter((u) => p.fixed.includes(u.id));
    if (
      s.tick !== 0 ||
      s.result ||
      s.arrivals.length ||
      s.energy !== 5 ||
      s.support !== 6 ||
      new Set(p.fixed).size !== p.fixed.length ||
      fixed.length !== p.fixed.length ||
      (c.mechanics === "containment"
        ? fixed.length !== 1 ||
          fixed[0].kind !== "macrophage" ||
          !s.internal.some(
            (i) => i.host === fixed[0].id && i.stage === "persistent",
          )
        : fixed.length !== 0) ||
      s.cells
        .filter((u) => !p.fixed.includes(u.id))
        .some(
          (u) =>
            !c.cells[u.kind].recruitable ||
            u.activation ||
            u.antigen ||
            u.recognized ||
            u.path.length ||
            u.order.type !== "guard",
        ) ||
      s.cells
        .filter((u) => !p.fixed.includes(u.id))
        .reduce((n, u) => n + c.cells[u.kind].cost, p.remaining) !==
        DEPLOYMENT_BUDGET
    )
      throw new Error("開局部署資料不一致。");
  }
  if (c.mechanics && !s.campaign) throw new Error("缺少關卡機制狀態。");
  if (s.result?.type === "limited" && c.mechanics !== "retroviral")
    throw new Error("特殊結局不屬於此關。");
  const fields = c.fields.map((f) => f.id);
  if (
    s.campaign &&
    [s.campaign.barrier, s.campaign.containment].some(
      (values) =>
        Object.keys(values).length !== fields.length ||
        fields.some((id) => values[id] === undefined),
    )
  )
    throw new Error("關卡組織狀態不完整。");
  if (
    s.scenario !== c.id ||
    s.tick > c.limit ||
    s.energy > c.energyMax ||
    s.wave >= c.waves.length
  )
    throw new Error("關卡、資源或進度超出範圍。");
  if (
    Object.keys(s.health).length !== fields.length ||
    fields.some((id) => s.health[id] === undefined)
  )
    throw new Error("區域資料不完整。");
  for (const thing of [...s.cells, ...s.colonies, ...s.arrivals, ...s.hosts])
    if (!fields.includes(thing.region)) throw new Error("未知區域。");
  for (const p of s.colonies)
    if (
      p.complementUntil === undefined ||
      p.antibodyUntil === undefined ||
      p.markedUntil !== Math.max(p.complementUntil, p.antibodyUntil)
    )
      throw new Error("補體／抗體時間資料不一致。");
  const ids = [
    ...s.cells,
    ...s.colonies,
    ...s.arrivals,
    ...s.internal,
    ...s.hosts,
  ].map((p) => p.id);
  if (
    new Set(ids).size !== ids.length ||
    ids.some(
      (id) => !/^([upqih])[0-9]+$/.test(id) || Number(id.slice(1)) >= s.serial,
    )
  )
    throw new Error("物件 ID 不合法。");
  for (const p of [...s.colonies, ...s.internal])
    if (p.pathogen !== c.pathogen.id) throw new Error("未知病原。");
  for (const p of s.internal)
    if (!s.cells.some((u) => u.id === p.host))
      throw new Error("胞內病原缺少宿主。");
  if (
    Object.keys(s.immunity.signals).length !== fields.length ||
    fields.some((id) => !s.immunity.signals[id])
  )
    throw new Error("訊號區域資料不完整。");
  if (
    !c.practice &&
    !c.mechanics &&
    s.hosts.some((h) => h.load > 0 || h.infection)
  )
    throw new Error("此肺炎鏈球菌案例沒有病毒感染宿主。");
  for (const h of s.hosts) {
    if (
      h.infection &&
      !c.practice &&
      (h.infection.pathogen !== c.pathogen.id ||
        !["viral", "retroviral"].includes(c.mechanics ?? "") ||
        !h.infection.phase ||
        h.infection.since === undefined ||
        h.infection.since > s.tick)
    )
      throw new Error("宿主感染來源或階段不合法。");
    if (
      h.infection?.phase === "latent" &&
      (c.mechanics !== "retroviral" || h.antigen !== "self")
    )
      throw new Error("潛伏宿主不可自動取得病毒肽。");
  }
  for (const p of s.internal) {
    if (
      p.stage === "processing" &&
      (p.clearAt <= s.tick || p.compartment !== "phagosome")
    )
      throw new Error("胞內處理時間或區室不合法。");
    if (p.stage === "persistent" && p.clearAt !== 0)
      throw new Error("胞內存活狀態不合法。");
  }
  if (
    s.hosts.some(
      (h) =>
        (h.load > 0 && !h.infection) ||
        h.health !== (h.apoptoticAt ? 0 : s.health[h.region]),
    )
  )
    throw new Error("宿主感染或組織健康資料不一致。");
  if (
    !c.practice &&
    !c.mechanics &&
    s.hosts.some((h) => h.load > 0 || h.infection)
  )
    throw new Error("此肺炎鏈球菌案例沒有病毒感染宿主。");
  if (s.immunity.node.stage !== "idle" && !s.immunity.node.antigen)
    throw new Error("呈遞缺少抗原。");
  if (s.result) {
    const rate = preservation(s);
    if (s.result.preservation !== rate || s.result.seconds !== s.tick * 0.2)
      throw new Error("結算資料不一致。");
    if (s.result.type === "victory" && !victoryCondition(s, c))
      throw new Error("勝利條件不成立。");
    if (
      s.result.type === "limited" &&
      (!limitedCondition(s, c) || s.result.stars !== 0)
    )
      throw new Error("有限結局條件不成立。");
  }
}
export function parseTactical(text: string, c: TacticalContent): TacticalSave {
  if (new TextEncoder().encode(text).length > 2_000_000)
    throw new Error("存檔超過 2 MB。");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("存檔不是有效 JSON，目前進度未變更。");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new Error("此檔不是新版即時戰術存檔；舊版存檔仍保留，請勿刪除原檔。");
  const data = parsed.data;
  const versions = {
    "2.0": "m1-tactics.1",
    "2.1": "m1-tactics.2",
    "2.2": "m1-tactics.3",
    "2.3": "m1-tactics.4",
    "2.4": "m1-tactics.5",
    "3.0": "campaign.1",
    "3.1": "campaign.2",
  };
  if (versions[data.rules] !== data.content)
    throw new Error("規則與內容版本不一致。");
  const migrate = (state: typeof data.state): TacticalState => {
    if (
      ["3.0", "3.1"].includes(data.rules) &&
      (!state.immunity ||
        !state.hosts?.length ||
        Object.values(state.immunity.signals).some(
          (s) =>
            s.ifni === undefined ||
            s.il17 === undefined ||
            s.il22 === undefined,
        ))
    )
      throw new Error("新版免疫／組織狀態不完整。");
    if (
      ["2.2", "2.3", "2.4", "3.0", "3.1"].includes(data.rules) &&
      (!state.immunity || !state.hosts)
    )
      throw new Error("新版免疫狀態不完整。");
    if (
      ["2.3", "2.4", "3.0", "3.1"].includes(data.rules) &&
      (!state.hosts?.length ||
        state.hosts.some(
          (h) =>
            !h.kind ||
            !h.layer ||
            h.health === undefined ||
            (h.load > 0 && !h.infection),
        ) ||
        state.internal.some(
          (p) => !p.compartment || !p.stage || p.clearAt === undefined,
        ))
    )
      throw new Error("新版組織／區室狀態不完整。");
    if (data.rules !== "3.1" && state.preparation)
      throw new Error("舊規則不可包含開局部署狀態。");
    const migrated: TacticalState = {
      ...state,
      immunity: {
        ...(state.immunity ?? initialImmunity(c, false)),
        signals: Object.fromEntries(
          Object.entries(
            state.immunity?.signals ?? initialImmunity(c, false).signals,
          ).map(([id, s]) => [id, { ifni: 0, il17: 0, il22: 0, ...s }]),
        ),
      },
      hosts: (state.hosts ?? []).map((h) => ({
        ...h,
        kind: h.kind ?? "alveolarII",
        layer: h.layer ?? "epithelium",
        health: h.health ?? (h.apoptoticAt ? 0 : state.health[h.region]),
        infection:
          h.infection ??
          (h.load > 0
            ? { pathogen: "teaching-virus", compartment: "cytosol" }
            : undefined),
      })),
      internal: state.internal.map((p) => ({
        ...p,
        compartment: p.compartment ?? "phagosome",
        stage: p.stage ?? "persistent",
        clearAt: p.clearAt ?? 0,
      })),
    };
    if (!["2.4", "3.0", "3.1"].includes(data.rules))
      for (const p of migrated.colonies) {
        const previous = coatings(p, 0);
        p.complementUntil = previous.complementUntil;
        p.antibodyUntil = previous.antibodyUntil;
      }
    if (
      !["2.3", "2.4", "3.0", "3.1"].includes(data.rules) &&
      !migrated.hosts.some((h) => h.wall)
    )
      populateTissue(migrated, c);
    return migrated;
  };
  const save: TacticalSave = {
    ...data,
    rules: "3.1",
    content: "campaign.2",
    state: migrate(data.state),
    undo: data.undo.map(migrate),
  };
  if (save.state.preparation && !save.paused)
    throw new Error("開局部署必須暫停。");
  check(save.state, c);
  for (const snapshot of save.undo) {
    check(snapshot, c);
    if (snapshot.tick !== save.state.tick || snapshot.seed !== save.state.seed)
      throw new Error("暫停指令快照不一致。");
  }
  if (
    !!save.records.m6 ||
    Object.values(save.records).some((r) => r.type !== "victory") ||
    save.read.some((id) => !entries.some((e) => e.id === id)) ||
    Object.keys(save.records).some(
      (id) => id !== c.id && !tacticalScenarios[id],
    )
  )
    throw new Error("未知內容紀錄。");
  return save;
}
export function readTactical(c: TacticalContent): {
  save?: TacticalSave;
  error?: string;
  migrated?: boolean;
} {
  try {
    const value = localStorage.getItem(TACTICS_KEY);
    return value
      ? {
          save: parseTactical(value, c),
          migrated: JSON.parse(value).rules !== "3.1",
        }
      : {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}
export function writeTactical(save: TacticalSave) {
  try {
    const previous = localStorage.getItem(TACTICS_KEY);
    let previousRules: unknown;
    try {
      previousRules = previous ? JSON.parse(previous).rules : undefined;
    } catch {
      /* Keep malformed originals too, then allow a valid import to repair the active save. */
    }
    if (
      previous &&
      previousRules !== "3.1" &&
      !localStorage.getItem("immuminati:tactics:pre-3.1")
    )
      localStorage.setItem("immuminati:tactics:pre-3.1", previous);
    localStorage.setItem(TACTICS_KEY, JSON.stringify(save));
    return "已儲存";
  } catch {
    return "儲存失敗，請匯出備份";
  }
}
export function exportTactical(save: TacticalSave) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(save, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "immuminati-tactics-v2.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Preserve the imported original before any format migration is committed. */
export function backupTacticalImport(text: string) {
  if (JSON.parse(text).rules === "3.1") return;
  localStorage.setItem(`immuminati:tactics:import-pre-3.1:${Date.now()}`, text);
}
