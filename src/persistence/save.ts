import { z } from "zod";
import {
  RULES_VERSION,
  CONTENT_VERSION,
  type SaveData,
  type Progress,
  type Content,
  type BattleState,
  type Session,
} from "../domain/model";
import { occupancy, preservation, resolveCommand } from "../engine/battle";
import { entries } from "../content/encyclopedia";
const int = (max = 100000) => z.number().int().min(0).max(max);
const id = z.string().min(1).max(60);
const kind = z.enum(["macrophage", "neutrophil", "dendritic"]);
const outcome = z
  .object({
    type: z.enum(["victory", "defeat"]),
    reason: z.string().max(300),
    preservation: int(100),
    stars: int(3),
    turn: int(1000),
  })
  .strict();
const battle = z
  .object({
    scenario: id,
    seed: int(4294967295),
    rng: int(4294967295),
    turn: z.number().int().min(1).max(1000),
    ap: int(100),
    opsonins: int(100),
    regions: z.record(id, int(10000)),
    units: z
      .array(
        z
          .object({
            id,
            kind,
            region: id,
            used: z.boolean(),
            priority: id.optional(),
          })
          .strict(),
      )
      .max(100),
    populations: z
      .array(
        z
          .object({
            id,
            pathogen: id,
            region: id,
            load: int(100000),
            compartment: z.enum(["extracellular", "phagosome", "cytosol"]),
            hostId: id.optional(),
            opsonin: int(100),
          })
          .strict(),
      )
      .max(100),
    recruits: z
      .array(z.object({ id, kind, region: id, remaining: int(100) }).strict())
      .max(100),
    nextId: int(),
    eventSeq: int(),
    outcome: outcome.optional(),
  })
  .strict();
const command = z.discriminatedUnion("type", [
  z.object({ type: z.literal("move"), unitId: id, region: id }).strict(),
  z.object({ type: z.literal("engulf"), unitId: id, targetId: id }).strict(),
  z.object({ type: z.literal("opsonize"), targetId: id }).strict(),
  z.object({ type: z.literal("recruit"), kind, region: id }).strict(),
  z.object({ type: z.literal("priority"), unitId: id, targetId: id }).strict(),
  z.object({ type: z.literal("endTurn") }).strict(),
]);
const event = z
  .object({
    id,
    type: z.enum([
      "UnitMoved",
      "PathogenEngulfed",
      "PathogenCleared",
      "IntracellularSurvival",
      "OpsoninApplied",
      "OpsoninExpired",
      "RecruitmentRequested",
      "RecruitmentWaiting",
      "UnitArrived",
      "PathogenReplicated",
      "PathogenSpread",
      "TissueDamaged",
      "PriorityChanged",
      "PriorityFallback",
      "TurnEnded",
      "BattleEnded",
    ]),
    turn: int(1000),
    phase: z.enum([
      "command",
      "cells",
      "pathogens",
      "tissue",
      "waiting",
      "result",
    ]),
    source: id.optional(),
    target: id.optional(),
    region: id.optional(),
    amount: int().optional(),
    reason: z.string().max(1000),
    data: z
      .record(id, z.union([z.string().max(1000), z.number().finite()]))
      .optional(),
  })
  .strict();
const schema = z
  .object({
    schemaVersion: z.literal(1),
    rulesVersion: z.literal(RULES_VERSION),
    contentVersion: z.literal(CONTENT_VERSION),
    session: z
      .object({
        state: battle,
        turnStart: battle,
        commands: z.array(command).max(100),
        events: z.array(event).max(15000),
        turnEventIndex: int(15000),
      })
      .strict()
      .nullable(),
    progress: z
      .object({
        records: z.record(id, outcome),
        read: z.array(id).max(300),
        revealed: z.array(id).max(100),
        settings: z
          .object({
            speed: z.union([z.literal(1), z.literal(2), z.literal(4)]),
            reducedMotion: z.boolean(),
            idle: z.boolean(),
            hints: z.boolean(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
export const SAVE_KEY = "immuminati:save:v1";
export const defaultProgress = (reduced = false): Progress => ({
  records: {},
  read: [],
  revealed: [],
  settings: { speed: 1, reducedMotion: reduced, idle: true, hints: true },
});
export const pack = (
  session: Session | null,
  progress: Progress,
): SaveData => ({
  schemaVersion: 1,
  rulesVersion: RULES_VERSION,
  contentVersion: CONTENT_VERSION,
  session,
  progress,
});
function checkBattle(b: BattleState, c: Content) {
  const s = c.scenarios[b.scenario];
  if (!s) throw new Error("此版本不支援存檔中的關卡。");
  const regions = s.regions.map((r) => r.id);
  if (
    Object.keys(b.regions).length !== regions.length ||
    regions.some((id) => b.regions[id] === undefined)
  )
    throw new Error("區域資料不完整。");
  if (b.ap > s.ap || b.opsonins > s.opsonins || b.turn > s.maxTurns)
    throw new Error("資源或回合超出範圍。");
  const ids = [...b.units, ...b.populations, ...b.recruits].map((v) => v.id);
  if (new Set(ids).size !== ids.length) throw new Error("重複的物件 ID。");
  if (
    ids.some(
      (id) => !/^([upq])[0-9]+$/.test(id) || Number(id.slice(1)) >= b.nextId,
    )
  )
    throw new Error("物件 ID 計數器不合法。");
  if (b.outcome) {
    const o = b.outcome;
    const total = b.populations.reduce((a, p) => a + p.load, 0);
    const lost = s.regions.some((r) => b.regions[r.id] <= 0);
    const win =
      !lost &&
      (s.mode === "clearance"
        ? total === 0
        : total <= (s.controlThreshold ?? 0));
    const rate = preservation(b, c);
    const stars = win
      ? rate >= s.stars[0]
        ? 3
        : rate >= s.stars[1]
          ? 2
          : 1
      : 0;
    if (
      o.turn !== b.turn ||
      o.preservation !== rate ||
      o.stars !== stars ||
      (o.type === "victory") !== win
    )
      throw new Error("結算內容與當局狀態不一致。");
  }
  for (const r of s.regions)
    if (b.regions[r.id] > r.maxHealth || occupancy(b, r.id) > r.capacity)
      throw new Error("區域健康或容量超出範圍。");
  for (const u of [...b.units, ...b.recruits])
    if (!regions.includes(u.region) || !c.cells[u.kind])
      throw new Error("未知的細胞或區域。");
  for (const p of b.populations) {
    if (!regions.includes(p.region) || !c.pathogens[p.pathogen])
      throw new Error("未知的病原或區域。");
    if (
      p.compartment !== "extracellular" &&
      !b.units.some((u) => u.id === p.hostId && u.region === p.region)
    )
      throw new Error("胞內來源缺少合法宿主。");
    if (p.compartment === "extracellular" && p.hostId)
      throw new Error("胞外來源不能包含宿主。");
  }
}
export function parseSave(text: string, c: Content): SaveData {
  if (new TextEncoder().encode(text).length > 2_000_000)
    throw new Error("檔案超過 2 MB 上限。");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("無法解析 JSON；目前進度未變更。");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new Error(
      "存檔格式或版本不相容；請保留原檔。目前版本為 schema 1 / rules " +
        RULES_VERSION +
        "。",
    );
  const save = parsed.data as SaveData;
  if (
    save.progress.read.some((id) => !entries.some((e) => e.id === id)) ||
    save.progress.revealed.length
  )
    throw new Error("未知的百科或結局 ID。");
  for (const key of Object.keys(save.progress.records))
    if (!c.scenarios[key]) throw new Error("紀錄包含未支援的關卡。");
  if (save.session) {
    const se = save.session;
    checkBattle(se.state, c);
    checkBattle(se.turnStart, c);
    if (
      se.events.some(
        (e) =>
          e.region &&
          !c.scenarios[se.state.scenario].regions.some(
            (r) => r.id === e.region,
          ),
      ) ||
      new Set(se.events.map((e) => e.id)).size !== se.events.length ||
      se.events.some(
        (e) =>
          !/^e[0-9]+$/.test(e.id) || Number(e.id.slice(1)) > se.state.eventSeq,
      )
    )
      throw new Error("事件紀錄不合法。");
    if (
      se.turnStart.scenario !== se.state.scenario ||
      se.turnStart.seed !== se.state.seed ||
      se.turnEventIndex > se.events.length
    )
      throw new Error("回合快照不一致。");
    let state = se.turnStart;
    for (const cmd of se.commands) {
      if (cmd.type === "endTurn") throw new Error("撤銷紀錄不合法。");
      const r = resolveCommand(state, cmd, c);
      if (r.error) throw new Error("指令無法重建：" + r.error);
      state = r.state;
    }
    if (JSON.stringify(state) !== JSON.stringify(se.state))
      throw new Error("當局狀態與撤銷紀錄不一致。");
  }
  return save;
}
export function load(c: Content): { save?: SaveData; error?: string } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? { save: parseSave(raw, c) } : {};
  } catch (e) {
    return { error: "無法讀取本機存檔：" + (e as Error).message };
  }
}
export function store(save: SaveData): string {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return "已自動儲存";
  } catch {
    return "本機儲存失敗；仍可遊玩，請匯出備份。";
  }
}
export function downloadSave(save: SaveData) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(save, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "immuminati-save.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
