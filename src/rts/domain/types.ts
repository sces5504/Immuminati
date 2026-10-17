export type Point = { x: number; y: number };
export type Kind = "macrophage" | "neutrophil" | "dendritic";
export type Action =
  | "patrol"
  | "chemotaxis"
  | "approach"
  | "contact"
  | "wrap"
  | "ingest"
  | "digest"
  | "survive"
  | "cooldown"
  | "mature"
  | "migrate"
  | "exit"
  | "extravasate";
export type Unit = Point & {
  id: string;
  kind: Kind;
  visualId: string;
  action: Action;
  since: number;
  until: number;
  target?: string;
  order?: Point;
  priority?: string;
  antigen?: string;
  cargo?: string;
  life: number;
  signal: boolean;
};
export type Pathogen = Point & {
  id: string;
  visualId: string;
  load: number;
  opsonin: "none" | "complement" | "antibody";
  opsAt: number;
  compartment: "external" | "internal";
  host?: string;
  survives: boolean;
  born: number;
  heading: number;
  antigen: string;
};
export type Command = {
  id: string;
  step: number;
  type:
    | "move"
    | "target"
    | "auto"
    | "opsonize"
    | "recruit"
    | "policy"
    | "dispatch"
    | "support";
  unit?: string;
  target?: string;
  point?: Point;
  policy?: "restrained" | "balanced" | "intense";
};
export type RuleEvent = {
  id: string;
  step: number;
  type: string;
  actor?: string;
  target?: string;
  at?: Point;
  text: string;
};
export type Recruit = {
  id: string;
  point: Point;
  phase: "waiting" | "mobilizing" | "crossing";
  until: number;
  entrance: Point;
};
export type NodePhase =
  | "antigen"
  | "maturation"
  | "migration"
  | "presentation"
  | "bActivation"
  | "differentiation"
  | "transport"
  | "active";
export type Scenario = {
  id: string;
  version: string;
  width: number;
  height: number;
  tissueBottom: number;
  dt: number;
  initial: { kind: Kind; x: number; y: number }[];
  foci: Point[];
  sourceSteps: number[];
  sourceClose: number;
  growthEvery: number;
  growth: number;
  split: number;
  signalStrength: number;
  signalDiffusion: number;
  signalDecay: number;
  resources: number;
  regen: number;
  supply: number;
  supplyRegen: number;
  costs: { recruit: number; opsonize: number; support: number };
  recruitDelay: number;
  crossing: number;
  tissueDamage: number;
  inflammationDamage: number;
  stages: Record<Exclude<NodePhase, "antigen" | "active">, number>;
  stars: [number, number];
  timeLimit: number;
};
export type State = {
  schema: 3;
  contentVersion: string;
  scenarioId: string;
  seed: number;
  rng: number;
  step: number;
  serial: number;
  units: Unit[];
  pathogens: Pathogen[];
  field: number[];
  inflammation: number;
  endothelial: number;
  tissue: number;
  damage: { pathogen: number; inflammation: number; bystander: number };
  resources: number;
  supply: number;
  recruits: Recruit[];
  node: {
    phase: NodePhase;
    until: number;
    antigen?: string;
    dc?: string;
    supported: boolean;
  };
  policy: "restrained" | "balanced" | "intense";
  sourceClosed: boolean;
  processed: string[];
  events: RuleEvent[];
  result?: {
    outcome: "won" | "lost";
    reason: string;
    stars: number;
    step: number;
  };
  stats: { cleared: number; recruited: number; captures: number };
};
export type Settings = {
  speed: 1 | 2 | 4;
  motion: "normal" | "reduced" | "skip";
  signals: boolean;
};
export type Save = {
  schema: 3;
  state: State;
  plans: Command[];
  settings: Settings;
  nextCommand: number;
};
