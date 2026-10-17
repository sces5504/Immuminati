import { z } from "zod";
import type {
  TacticalContent,
  TacticalSave,
  TacticalState,
} from "../domain/model";
import { occupied, preservation, loadOf } from "../engine/simulation";
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
const kind = z.enum(["macrophage", "neutrophil", "dendritic"]);
const order = z.discriminatedUnion("type", [
  z.object({ type: z.literal("guard"), point: vec }).strict(),
  z.object({ type: z.literal("move"), point: vec }).strict(),
  z.object({ type: z.literal("attack"), target: id }).strict(),
]);
const result = z
  .object({
    type: z.enum(["victory", "defeat"]),
    reason: z.string().max(300),
    preservation: integer(100),
    stars: integer(3),
    seconds: num(3600),
  })
  .strict();
const battle = z
  .object({
    version: z.literal(2),
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
          })
          .strict(),
      )
      .max(20),
    colonies: z
      .array(
        z
          .object({
            id,
            region: id,
            position: vec,
            load: integer(1000),
            markedUntil: integer(10000),
            pathogen: id,
          })
          .strict(),
      )
      .max(200),
    arrivals: z
      .array(z.object({ id, kind, region: id, at: integer(10000) }).strict())
      .max(20),
    internal: z
      .array(
        z.object({ id, host: id, load: integer(1000), pathogen: id }).strict(),
      )
      .max(20),
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
            ]),
            actor: id.optional(),
            target: id.optional(),
            position: vec,
            from: vec.optional(),
            amount: num(10000),
            message: z.string().max(1000),
            survives: z.boolean().optional(),
          })
          .strict(),
      )
      .max(400),
    result: result.optional(),
  })
  .strict();
const schema = z
  .object({
    schema: z.literal(2),
    rules: z.literal("2.0"),
    content: z.literal("m1-tactics.1"),
    state: battle,
    paused: z.boolean(),
    undo: z.array(battle).max(10),
    settings: z
      .object({
        speed: z.union([z.literal(1), z.literal(2)]),
        reduced: z.boolean(),
        idle: z.boolean(),
        hints: z.boolean(),
      })
      .strict(),
    read: z.array(id).max(200),
    records: z.record(id, result),
  })
  .strict();
function check(s: TacticalState, c: TacticalContent) {
  const fields = c.fields.map((f) => f.id);
  if (
    s.scenario !== c.id ||
    s.tick > c.limit ||
    s.energy > c.energyMax ||
    s.wave >= c.waves.length ||
    s.cells.length + s.arrivals.length > c.maxCells
  )
    throw new Error("關卡、資源或進度超出範圍。");
  if (
    Object.keys(s.health).length !== fields.length ||
    fields.some((id) => s.health[id] === undefined)
  )
    throw new Error("區域資料不完整。");
  for (const field of c.fields)
    if (occupied(s, field.id) > field.capacity)
      throw new Error("容量預約超出上限。");
  for (const thing of [...s.cells, ...s.colonies, ...s.arrivals])
    if (!fields.includes(thing.region)) throw new Error("未知區域。");
  const ids = [...s.cells, ...s.colonies, ...s.arrivals, ...s.internal].map(
    (p) => p.id,
  );
  if (
    new Set(ids).size !== ids.length ||
    ids.some(
      (id) => !/^([upqi])[0-9]+$/.test(id) || Number(id.slice(1)) >= s.serial,
    )
  )
    throw new Error("物件 ID 不合法。");
  for (const p of [...s.colonies, ...s.internal])
    if (p.pathogen !== c.pathogen.id) throw new Error("未知病原。");
  for (const p of s.internal)
    if (!s.cells.some((u) => u.id === p.host))
      throw new Error("胞內病原缺少宿主。");
  if (s.result) {
    const rate = preservation(s);
    if (s.result.preservation !== rate || s.result.seconds !== s.tick * 0.2)
      throw new Error("結算資料不一致。");
    if (
      s.result.type === "victory" &&
      (loadOf(s) > 0 ||
        s.wave !== c.waves.length - 1 ||
        Object.values(s.health).some((h) => h <= 0))
    )
      throw new Error("勝利條件不成立。");
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
  const save = parsed.data as TacticalSave;
  check(save.state, c);
  for (const snapshot of save.undo) {
    check(snapshot, c);
    if (snapshot.tick !== save.state.tick || snapshot.seed !== save.state.seed)
      throw new Error("暫停指令快照不一致。");
  }
  if (
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
} {
  try {
    const value = localStorage.getItem(TACTICS_KEY);
    return value ? { save: parseTactical(value, c) } : {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}
export function writeTactical(save: TacticalSave) {
  try {
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
