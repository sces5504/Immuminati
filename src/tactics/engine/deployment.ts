import type {
  CellType,
  TacticalCommand,
  TacticalContent,
  TacticalState,
} from "../domain/model";
import { deploymentKits, DEPLOYMENT_BUDGET } from "../content/deployment";
type DeploymentCommand = Extract<
  TacticalCommand,
  { type: "deploy" | "withdraw" | "deploy-kit" | "begin" }
>;
export function isDeploymentCommand(
  cmd: TacticalCommand,
): cmd is DeploymentCommand {
  return ["deploy", "withdraw", "deploy-kit", "begin"].includes(cmd.type);
}
export function validateDeployment(
  s: TacticalState,
  cmd: TacticalCommand,
  c: TacticalContent,
): string | undefined {
  if (!s.preparation) return "部署已確認；開戰後請使用募集增援。";
  const p = s.preparation;
  if (cmd.type === "deploy") {
    if (
      !c.cells[cmd.kind]?.recruitable ||
      (c.allowed && !c.allowed.includes(cmd.kind))
    )
      return "此細胞不可直接部署。";
    if (!c.fields.some((f) => f.id === cmd.region)) return "未知起始防區。";
    if (p.remaining < c.cells[cmd.kind].cost)
      return "開局部署點不足；可移除已選細胞再調整。";
  } else if (cmd.type === "withdraw") {
    if (!s.cells.some((u) => u.id === cmd.cell)) return "部署單位不存在。";
    if (p.fixed.includes(cmd.cell))
      return "這是情境中已感染的宿主，不能以撤下刪除感染。";
  } else if (cmd.type === "deploy-kit") {
    const kit = deploymentKits[c.id]?.find((k) => k.id === cmd.kit);
    if (
      !kit ||
      kit.units.reduce((n, u) => n + c.cells[u.kind].cost, 0) >
        DEPLOYMENT_BUDGET
    )
      return "套組不存在或超過預算。";
  } else if (cmd.type === "begin") {
    if (!s.cells.some((u) => !p.fixed.includes(u.id)))
      return "先選擇套組或自行部署至少一個細胞。";
  } else return "請先完成開局部署，再使用戰場指令。";
}
export function applyDeployment(
  s: TacticalState,
  cmd: TacticalCommand,
  c: TacticalContent,
) {
  const p = s.preparation!;
  const add = (kind: CellType, region: string) => {
    const f = c.fields.find((f) => f.id === region)!;
    const count = s.cells.filter((u) => u.region === region).length;
    const angle = count * 2.4;
    const position = {
      x: f.center.x + Math.sin(angle) * 2,
      z: f.center.z + 2 + Math.cos(angle),
    };
    s.cells.push({
      id: `u${s.serial++}`,
      kind,
      region,
      position,
      order: { type: "guard", point: { ...position } },
      path: [],
      readyAt: 0,
    });
    p.remaining -= c.cells[kind].cost;
  };
  if (cmd.type === "deploy") add(cmd.kind, cmd.region);
  else if (cmd.type === "withdraw") {
    p.remaining += c.cells[s.cells.find((u) => u.id === cmd.cell)!.kind].cost;
    s.cells = s.cells.filter((u) => u.id !== cmd.cell);
  } else if (cmd.type === "deploy-kit") {
    s.cells = s.cells.filter((u) => p.fixed.includes(u.id));
    p.remaining = DEPLOYMENT_BUDGET;
    for (const unit of deploymentKits[c.id].find((k) => k.id === cmd.kit)!
      .units)
      add(unit.kind, unit.region);
  } else if (cmd.type === "begin") delete s.preparation;
}
