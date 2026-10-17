import { z } from "zod";
import { M1, ANTIGEN } from "../content/m1";
import type { Save } from "../domain/types";
import { GRID_W, GRID_H } from "../engine/simulation";
export const SAVE_KEY = "immuminati:rts:v3";
const n = z.number().finite(),
  non = n.nonnegative(),
  int = non.int(),
  id = z.string().regex(/^[a-z][\w:.-]{0,100}$/),
  point = { x: n.min(0).max(1000), y: n.min(0).max(680) };
const action = z.enum([
  "patrol",
  "chemotaxis",
  "approach",
  "contact",
  "wrap",
  "ingest",
  "digest",
  "survive",
  "cooldown",
  "mature",
  "migrate",
  "exit",
  "extravasate",
]);
const cmd = z
  .object({
    id,
    step: int,
    type: z.enum([
      "move",
      "target",
      "auto",
      "opsonize",
      "recruit",
      "policy",
      "dispatch",
      "support",
    ]),
    unit: id.optional(),
    target: id.optional(),
    point: z.object(point).optional(),
    policy: z.enum(["restrained", "balanced", "intense"]).optional(),
  })
  .strict();
const schema = z
  .object({
    schema: z.literal(3),
    state: z
      .object({
        schema: z.literal(3),
        contentVersion: z.literal(M1.version),
        scenarioId: z.literal("M1"),
        seed: int.max(4294967295),
        rng: int.max(4294967295),
        step: int.max(100000),
        serial: int,
        units: z
          .array(
            z
              .object({
                ...point,
                id,
                kind: z.enum(["macrophage", "neutrophil", "dendritic"]),
                visualId: z.enum([
                  "cell.macrophage.v1",
                  "cell.neutrophil.v1",
                  "cell.dendritic.v1",
                ]),
                action,
                since: int,
                until: int,
                target: id.optional(),
                order: z.object(point).optional(),
                priority: id.optional(),
                antigen: z.literal(ANTIGEN).optional(),
                cargo: id.optional(),
                life: n.min(-1).max(1e9),
                signal: z.boolean(),
              })
              .strict(),
          )
          .max(1000),
        pathogens: z
          .array(
            z
              .object({
                ...point,
                id,
                visualId: z.literal("pathogen.spn.v1"),
                load: non.max(1e8),
                opsonin: z.enum(["none", "complement", "antibody"]),
                opsAt: int,
                compartment: z.enum(["external", "internal"]),
                host: id.optional(),
                survives: z.boolean(),
                born: int,
                heading: n,
                antigen: z.literal(ANTIGEN),
              })
              .strict(),
          )
          .max(5000),
        field: z.array(non.max(12)).length(GRID_W * GRID_H),
        inflammation: non.max(100),
        endothelial: non.max(100),
        tissue: non.max(100),
        damage: z
          .object({ pathogen: non, inflammation: non, bystander: non })
          .strict(),
        resources: non.max(150),
        supply: non.max(12),
        recruits: z
          .array(
            z
              .object({
                id,
                point: z.object(point),
                phase: z.enum(["waiting", "mobilizing", "crossing"]),
                until: int,
                entrance: z.object(point),
              })
              .strict(),
          )
          .max(1000),
        node: z
          .object({
            phase: z.enum([
              "antigen",
              "maturation",
              "migration",
              "presentation",
              "bActivation",
              "differentiation",
              "transport",
              "active",
            ]),
            until: int,
            antigen: z.literal(ANTIGEN).optional(),
            dc: id.optional(),
            supported: z.boolean(),
          })
          .strict(),
        policy: z.enum(["restrained", "balanced", "intense"]),
        sourceClosed: z.boolean(),
        processed: z.array(id).max(20000),
        events: z
          .array(
            z
              .object({
                id,
                step: int,
                type: z.string().max(50),
                actor: id.optional(),
                target: id.optional(),
                at: z.object(point).optional(),
                text: z.string().max(1000),
              })
              .strict(),
          )
          .max(100000),
        result: z
          .object({
            outcome: z.enum(["won", "lost"]),
            reason: z.string().max(1000),
            stars: int.max(3),
            step: int,
          })
          .strict()
          .optional(),
        stats: z
          .object({ cleared: non, recruited: int, captures: int })
          .strict(),
      })
      .strict(),
    plans: z.array(cmd).max(1000),
    settings: z
      .object({
        speed: z.union([z.literal(1), z.literal(2), z.literal(4)]),
        motion: z.enum(["normal", "reduced", "skip"]),
        signals: z.boolean(),
      })
      .strict(),
    nextCommand: int.positive(),
  })
  .strict();
export function decode(raw: string): Save {
  if (raw.length > 8_000_000) throw new Error("檔案超過 8 MB");
  const parsed = schema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error("存檔格式／版本或數值不相容");
  const s = parsed.data.state;
  const ids = [...s.units, ...s.pathogens, ...s.recruits, ...s.events].map(
    (x) => x.id,
  );
  if (new Set(ids).size !== ids.length) throw new Error("重複物件 ID");
  if (
    new Set(s.processed).size !== s.processed.length ||
    new Set(parsed.data.plans.map((c) => c.id)).size !==
      parsed.data.plans.length
  )
    throw new Error("重複指令 ID");
  const us = new Map(s.units.map((u) => [u.id, u])),
    bs = new Map(s.pathogens.map((b) => [b.id, b]));
  for (const b of s.pathogens)
    if (
      (b.compartment === "internal") !== !!b.host ||
      (b.host && (!us.has(b.host) || us.get(b.host)?.cargo !== b.id))
    )
      throw new Error("胞內宿主引用不一致");
  for (const u of s.units) {
    if (
      u.visualId !== `cell.${u.kind}.v1` ||
      (u.cargo && (!bs.has(u.cargo) || bs.get(u.cargo)?.host !== u.id)) ||
      u.since > s.step
    )
      throw new Error("細胞狀態引用不一致");
  }
  if (
    s.node.phase !== "antigen" &&
    (!s.node.antigen || !s.node.dc || !us.has(s.node.dc))
  )
    throw new Error("淋巴結抗原／DC 缺失");
  for (const u of s.units) {
    if (
      u.y > M1.tissueBottom ||
      (u.order &&
        (u.order.x < 35 ||
          u.order.x > 965 ||
          u.order.y < 35 ||
          u.order.y > M1.tissueBottom))
    )
      throw new Error("細胞位於非法組織");
    if (
      ["contact", "wrap", "ingest", "digest", "survive"].includes(u.action) &&
      !bs.has(u.target ?? "")
    )
      throw new Error("作用目標引用不一致");
  }
  if (s.pathogens.some((b) => b.y > M1.tissueBottom || b.load <= 0))
    throw new Error("病原位置／活負荷不一致");
  for (const c of parsed.data.plans) {
    if (
      (["move", "recruit"].includes(c.type) &&
        (!c.point ||
          c.point.x < 35 ||
          c.point.x > 965 ||
          c.point.y < 35 ||
          c.point.y > M1.tissueBottom)) ||
      (["target", "opsonize"].includes(c.type) && !bs.has(c.target ?? "")) ||
      (c.type === "policy" && !c.policy)
    )
      throw new Error("規劃參數不一致");
  }
  if (
    s.result &&
    ((s.result.outcome === "won") !== s.result.stars > 0 ||
      (s.result.outcome === "won" &&
        (!s.sourceClosed || s.pathogens.length > 0 || s.tissue <= 0)))
  )
    throw new Error("結算狀態不一致");
  if (
    s.events.some((e) => e.step > s.step) ||
    (s.result && s.result.step !== s.step) ||
    s.sourceClosed !== s.step >= M1.sourceClose
  )
    throw new Error("模擬時鐘不一致");
  if (
    parsed.data.plans.some(
      (c) =>
        s.processed.includes(c.id) ||
        c.step !== s.step + 1 ||
        (["move", "auto", "target", "dispatch"].includes(c.type) &&
          !us.has(c.unit ?? "")),
    )
  )
    throw new Error("規劃引用不一致");
  if (
    parsed.data.nextCommand <=
    Math.max(
      0,
      ...[...s.processed, ...parsed.data.plans.map((c) => c.id)].map(
        (x) => Number(x.slice(1)) || 0,
      ),
    )
  )
    throw new Error("指令序號不一致");
  return parsed.data as Save;
}
export function store(save: Save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}
export function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  return raw ? decode(raw) : undefined;
}
