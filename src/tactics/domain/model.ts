export type Vec = { x: number; z: number };
export type CellType = "macrophage" | "neutrophil" | "dendritic";
export type Order =
  | { type: "guard"; point: Vec }
  | { type: "move"; point: Vec }
  | { type: "attack"; target: string };
export interface Cell {
  id: string;
  kind: CellType;
  position: Vec;
  region: string;
  order: Order;
  path: Vec[];
  readyAt: number;
}
export interface Colony {
  id: string;
  region: string;
  position: Vec;
  load: number;
  markedUntil: number;
  pathogen: string;
}
export interface Arrival {
  id: string;
  kind: CellType;
  region: string;
  at: number;
}
export interface Internal {
  id: string;
  host: string;
  load: number;
  pathogen: string;
}
export interface TacticalEvent {
  id: number;
  tick: number;
  type:
    | "move"
    | "engulf"
    | "clear"
    | "survive"
    | "mark"
    | "arrive"
    | "request"
    | "grow"
    | "spread"
    | "damage"
    | "wave"
    | "result";
  actor?: string;
  target?: string;
  position: Vec;
  from?: Vec;
  amount: number;
  message: string;
  survives?: boolean;
}
export interface Result {
  type: "victory" | "defeat";
  reason: string;
  preservation: number;
  stars: number;
  seconds: number;
}
export interface TacticalState {
  version: 2;
  scenario: string;
  seed: number;
  rng: number;
  tick: number;
  energy: number;
  support: number;
  wave: number;
  nextWaveAt: number;
  health: Record<string, number>;
  cells: Cell[];
  colonies: Colony[];
  arrivals: Arrival[];
  internal: Internal[];
  serial: number;
  eventId: number;
  events: TacticalEvent[];
  result?: Result;
}
export interface Field {
  id: string;
  name: string;
  center: Vec;
  radius: number;
  capacity: number;
}
export interface CellSpec {
  name: string;
  short: string;
  speed: number;
  range: number;
  power: number;
  markedBonus: number;
  cooldown: number;
  cost: number;
  delay: number;
  color: number;
}
export interface Wave {
  after: number;
  label: string;
  groups: { region: string; offset: Vec; load: number }[];
}
export interface TacticalContent {
  id: string;
  title: string;
  pathogen: { id: string; name: string; survives: boolean };
  fields: Field[];
  portal: Vec;
  cells: Record<CellType, CellSpec>;
  initial: { kind: CellType; region: string; offset: Vec }[];
  waves: Wave[];
  limit: number;
  energyMax: number;
  energyEvery: number;
  markCost: number;
  markDuration: number;
  growEvery: number;
  growth: number;
  damageEvery: number;
  damagePerLoad: number;
  spreadAt: number;
  maxCells: number;
  stars: [number, number];
}
export type TacticalCommand =
  | { type: "move"; cell: string; point: Vec }
  | { type: "attack"; cell: string; target: string }
  | { type: "guard"; cell: string }
  | { type: "mark"; target: string }
  | { type: "recruit"; kind: CellType; region: string }
  | { type: "advance" };
export interface TacticalSettings {
  speed: 1 | 2;
  reduced: boolean;
  idle: boolean;
  hints: boolean;
}
export interface TacticalSave {
  schema: 2;
  rules: "2.0";
  content: "m1-tactics.1";
  state: TacticalState;
  paused: boolean;
  undo: TacticalState[];
  settings: TacticalSettings;
  read: string[];
  records: Record<string, Result>;
}
export const STEP_SECONDS = 0.2;
