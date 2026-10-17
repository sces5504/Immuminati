export const RULES_VERSION = "1.0.0";
export const CONTENT_VERSION = "m1.1";
export type CellKind = "macrophage" | "neutrophil" | "dendritic";
export type Compartment = "extracellular" | "phagosome" | "cytosol";
export interface CellDefinition {
  id: CellKind;
  name: string;
  short: string;
  cost: number;
  delay: number;
  power: number;
  unmarkedPower: number;
  description: string;
  encyclopedia: string;
}
export interface PathogenDefinition {
  id: string;
  name: string;
  english: string;
  antigen: string;
  survivesEngulfment: boolean;
  replication: number;
  intracellularGrowth: number;
  sources: string[];
}
export interface RegionDefinition {
  id: string;
  name: string;
  subtitle: string;
  x: number;
  y: number;
  capacity: number;
  maxHealth: number;
  weight: number;
  neighbors: string[];
}
export interface ScenarioDefinition {
  id: string;
  title: string;
  pathogen: string;
  mode: "clearance" | "containment";
  description: string;
  regions: RegionDefinition[];
  initialLoads: number[];
  variants: number[][];
  initialUnits: { kind: CellKind; region: string }[];
  pool: CellKind[];
  ap: number;
  opsonins: number;
  opsoninDuration: number;
  maxTurns: number;
  spreadThreshold: number;
  damagePerLoad: number;
  stars: [number, number];
  controlThreshold?: number;
}
export interface Content {
  cells: Record<CellKind, CellDefinition>;
  pathogens: Record<string, PathogenDefinition>;
  scenarios: Record<string, ScenarioDefinition>;
}
export interface Unit {
  id: string;
  kind: CellKind;
  region: string;
  used: boolean;
  priority?: string;
}
export interface Population {
  id: string;
  pathogen: string;
  region: string;
  load: number;
  compartment: Compartment;
  hostId?: string;
  opsonin: number;
}
export interface Recruitment {
  id: string;
  kind: CellKind;
  region: string;
  remaining: number;
}
export interface Outcome {
  type: "victory" | "defeat";
  reason: string;
  preservation: number;
  stars: number;
  turn: number;
}
export interface BattleState {
  scenario: string;
  seed: number;
  rng: number;
  turn: number;
  ap: number;
  opsonins: number;
  regions: Record<string, number>;
  units: Unit[];
  populations: Population[];
  recruits: Recruitment[];
  nextId: number;
  eventSeq: number;
  outcome?: Outcome;
}
export type Command =
  | { type: "move"; unitId: string; region: string }
  | { type: "engulf"; unitId: string; targetId: string }
  | { type: "opsonize"; targetId: string }
  | { type: "recruit"; kind: CellKind; region: string }
  | { type: "priority"; unitId: string; targetId: string }
  | { type: "endTurn" };
export type EventType =
  | "UnitMoved"
  | "PathogenEngulfed"
  | "PathogenCleared"
  | "IntracellularSurvival"
  | "OpsoninApplied"
  | "OpsoninExpired"
  | "RecruitmentRequested"
  | "RecruitmentWaiting"
  | "UnitArrived"
  | "PathogenReplicated"
  | "PathogenSpread"
  | "TissueDamaged"
  | "PriorityChanged"
  | "PriorityFallback"
  | "TurnEnded"
  | "BattleEnded";
export interface BattleEvent {
  id: string;
  type: EventType;
  turn: number;
  phase: "command" | "cells" | "pathogens" | "tissue" | "waiting" | "result";
  source?: string;
  target?: string;
  region?: string;
  amount?: number;
  reason: string;
  data?: Record<string, string | number>;
}
export interface Frame {
  event: BattleEvent;
  state: BattleState;
}
export interface Resolution {
  state: BattleState;
  frames: Frame[];
  error?: string;
}
export interface Session {
  state: BattleState;
  turnStart: BattleState;
  commands: Command[];
  events: BattleEvent[];
  turnEventIndex: number;
}
export interface Settings {
  speed: number;
  reducedMotion: boolean;
  idle: boolean;
  hints: boolean;
}
export interface Progress {
  records: Record<string, Outcome>;
  read: string[];
  revealed: string[];
  settings: Settings;
}
export interface SaveData {
  schemaVersion: 1;
  rulesVersion: string;
  contentVersion: string;
  session: Session | null;
  progress: Progress;
}
