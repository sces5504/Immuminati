import type {
  Cell,
  HostCell,
  Immunity,
  TacticalContent,
  TacticalState,
  Vec,
} from "../domain/model";
import { emit } from "./events";
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v: number) => Math.max(0, Math.min(100, v));
export function initialImmunity(c: TacticalContent): Immunity {
  return {
    autoSeek: false,
    signals: Object.fromEntries(
      c.fields.map((f) => [
        f.id,
        { cxcl8: 0, il12: 0, ifng: 0, il10: 0, inflammation: 0 },
      ]),
    ),
    node: { stage: "idle", antigen: "", until: 0 },
    antibodies: 0,
  };
}
export function validHostTarget(
  cell: Cell,
  host: HostCell,
  c: TacticalContent,
) {
  if (host.load <= 0) return false;
  const role = c.cells[cell.kind].role;
  return role === "nk"
    ? host.stressed && !host.mhc1
    : role === "cytotoxic" &&
        cell.activation === "effector" &&
        !!cell.antigen &&
        cell.antigen === host.antigen &&
        host.mhc1;
}
const nodePoint = (c: TacticalContent) => c.lymphExit ?? c.portal;
export function updateImmunity(s: TacticalState, c: TacticalContent) {
  const node = s.immunity.node;
  if (node.stage === "presenting" && s.tick >= node.until) {
    node.stage = "primed";
    emit(
      s,
      "present",
      nodePoint(c),
      "淋巴結：MHC-II／蛋白肽及共刺激已就緒；相符 CD4 T 可活化。這不是 MHC-I 交叉呈遞，不會直接活化 CD8。",
      1,
    );
  }
  if (s.tick % 5 !== 0) return;
  for (const f of c.fields) {
    const signal = s.immunity.signals[f.id];
    signal.cxcl8 = clamp(signal.cxcl8 - 3);
    signal.il12 = clamp(signal.il12 - 4);
    signal.ifng = clamp(signal.ifng - 5);
    signal.il10 = clamp(signal.il10 - 5);
    signal.inflammation = clamp(signal.inflammation - 1.5);
    for (const cell of s.cells.filter(
      (u) => dist(u.position, f.center) <= f.radius,
    )) {
      const role = c.cells[cell.kind].role;
      const nearby = s.colonies.some(
        (p) => p.load > 0 && dist(p.position, cell.position) <= 5,
      );
      if (nearby && ["phagocyte", "presenter"].includes(role)) {
        signal.cxcl8 = clamp(signal.cxcl8 + 9);
        if (cell.kind === "macrophage" || role === "presenter")
          signal.il12 = clamp(signal.il12 + 7);
        signal.inflammation = clamp(signal.inflammation + 3);
        if (!cell.recognized) {
          cell.recognized = true;
          emit(
            s,
            "recognize",
            cell.position,
            `${c.cells[cell.kind].name}以 PRRs（含 TLR）辨識微生物模式，${cell.kind === "neutrophil" ? "促進局部趨化與發炎" : "誘發 CXCL8／IL-12"}；辨識不等於抗原專一性。`,
            1,
            { actor: cell.id },
          );
        }
      }
      if (
        (role === "helper" &&
          cell.activation === "effector" &&
          dist(cell.position, nodePoint(c)) > 2.1) ||
        (role === "nk" && signal.il12 >= 15)
      ) {
        signal.ifng = clamp(signal.ifng + 10);
        signal.inflammation = clamp(signal.inflammation + 1);
        if (s.tick % 25 === 0)
          emit(
            s,
            "signal",
            cell.position,
            `${c.cells[cell.kind].name}提供 IFN-γ，增強此區巨噬功能；訊號本身不造成直接傷害。`,
            1,
            { actor: cell.id },
          );
      }
      if (role === "regulatory") {
        signal.il10 = clamp(signal.il10 + 15);

        if (s.tick % 25 === 0)
          emit(
            s,
            "regulate",
            cell.position,
            "Treg 的 IL-10 調節局部反應：降低發炎及部分促炎訊號，不直接回血；過早抑制也可能減弱防禦。",
            1,
            { actor: cell.id },
          );
      }
    }
    // Persisting IL-10 remains effective after its source moves away.
    signal.inflammation = clamp(signal.inflammation - signal.il10 * 0.1);
    signal.cxcl8 = clamp(signal.cxcl8 - signal.il10 * 0.025);
    signal.ifng = clamp(signal.ifng - signal.il10 * 0.03);
  }
  for (const cell of s.cells.filter((u) => u.kind === "macrophage")) {
    const region = c.fields.reduce((a, b) =>
      dist(cell.position, a.center) < dist(cell.position, b.center) ? a : b,
    ).id;
    if (s.immunity.signals[region].ifng >= 20) {
      const internal = s.internal.find(
        (p) =>
          p.host === cell.id &&
          p.load > 0 &&
          p.stage === "persistent" &&
          p.compartment === "phagosome",
      );
      if (internal && s.tick % 15 === 0) {
        internal.load--;
        emit(
          s,
          "clear",
          cell.position,
          "IFN-γ 活化巨噬細胞，增強囊泡內清除；此胞內來源減少 1。",
          1,
          { actor: cell.id, target: internal.id },
        );
      }
    }
  }
  s.internal = s.internal.filter((p) => p.load > 0);
  if (s.immunity.antibodies > 0 && s.tick % 25 === 0) {
    for (const p of s.colonies) {
      if (s.immunity.antibodies < 1 || p.markedUntil > s.tick + 5) continue;
      s.immunity.antibodies--;
      p.opsonin = "antibody";
      p.markedUntil = Math.max(p.markedUntil, s.tick + 30);
      emit(
        s,
        "mark",
        p.position,
        "新生特異性抗體結合蛋白抗原，經 Fc 受體與補體促進調理；仍須吞噬者接觸清除。",
        30,
        { target: p.id },
      );
    }
  }
}
/** Automatic intent never overrides an explicit movement order. */
export function supportDestination(
  s: TacticalState,
  cell: Cell,
  c: TacticalContent,
): Vec | undefined {
  const role = c.cells[cell.kind].role;
  if (
    role === "presenter" &&
    cell.antigen &&
    ["idle", "migrating"].includes(s.immunity.node.stage)
  )
    return nodePoint(c);
  if ((role === "helper" || role === "bcell") && cell.activation !== "effector")
    return nodePoint(c);
  if (role === "antibody") return nodePoint(c);
  if (
    role === "helper" &&
    cell.activation === "effector" &&
    s.cells.some((u) => u.kind === "bcell" && u.activation !== "effector")
  )
    return nodePoint(c);
  if (
    role === "helper" &&
    cell.activation === "effector" &&
    !s.immunity.autoSeek
  )
    return c.fields.find((f) => f.id === cell.region)?.center;
  if (role === "nk" || role === "cytotoxic") {
    const ordered =
      cell.order.type === "attack"
        ? s.hosts.find(
            (h) =>
              h.id === (cell.order as { target: string }).target &&
              validHostTarget(cell, h, c),
          )
        : undefined;
    const target =
      ordered ??
      (s.immunity.autoSeek
        ? [...s.hosts]
            .filter((h) => validHostTarget(cell, h, c))
            .sort(
              (a, b) =>
                dist(a.position, cell.position) -
                  dist(b.position, cell.position) || a.id.localeCompare(b.id),
            )[0]
        : s.hosts.find(
            (h) => validHostTarget(cell, h, c) && h.region === cell.region,
          ));
    if (target) return target.position;
  }
  if (
    s.immunity.autoSeek &&
    ["helper", "regulatory", "nk"].includes(role) &&
    cell.activation !== "activating"
  )
    return [...s.colonies].sort(
      (a, b) =>
        dist(cell.position, a.position) - dist(cell.position, b.position) ||
        a.id.localeCompare(b.id),
    )[0]?.position;
}
export function supportCell(
  s: TacticalState,
  cell: Cell,
  c: TacticalContent,
): boolean {
  const role = c.cells[cell.kind].role,
    node = s.immunity.node;
  const inNode = dist(cell.position, nodePoint(c)) <= 2.1;
  if (role === "presenter" && cell.antigen) {
    if (["idle", "migrating"].includes(node.stage)) {
      if (inNode) {
        node.stage = "presenting";
        node.antigen = cell.antigen;
        node.until = s.tick + 40;
        emit(
          s,
          "present",
          nodePoint(c),
          "樹突細胞經引流到達淋巴結：開始蛋白肽 MHC-II 呈遞，需共刺激與活化等待。",
          8,
          { actor: cell.id },
        );
      }
    }
    return true;
  }
  if (role === "helper" || role === "bcell") {
    if (!cell.activation || cell.activation === "resting") {
      const helper = s.cells.some(
        (u) =>
          u.kind === "helperT" &&
          u.activation === "effector" &&
          u.antigen === node.antigen &&
          dist(u.position, nodePoint(c)) <= 3,
      );
      if (
        inNode &&
        node.stage === "primed" &&
        (!cell.antigen || cell.antigen === node.antigen) &&
        (role === "helper" || helper)
      ) {
        cell.activation = "activating";
        cell.antigen = node.antigen;
        cell.activationAt = s.tick + (role === "helper" ? 40 : 50);
        emit(
          s,
          "activate",
          nodePoint(c),
          role === "helper"
            ? "相符 CD4 T 接受 MHC-II 肽／共刺激，開始擴增分化（8 秒教學壓縮）。"
            : "B 細胞結合相符蛋白抗原並接受已活化 T 細胞幫助，開始向漿細胞分化（10 秒壓縮）。",
          1,
          { actor: cell.id },
        );
      }
    } else if (
      cell.activation === "activating" &&
      s.tick >= (cell.activationAt ?? Infinity)
    ) {
      cell.activation = "effector";
      if (role === "bcell") cell.kind = "plasma";
      emit(
        s,
        "activate",
        cell.position,
        role === "bcell"
          ? "B 細胞已分化成漿細胞，接下來持續產生特異性抗體。"
          : "CD4 T 已活化：Tfh 型幫助可支持 B 細胞；調度至組織則提供 Th1 型巨噬支援。本局將亞群聚合為一個支援族群。",
        1,
        { actor: cell.id },
      );
    }
    return true;
  }
  if (role === "antibody") {
    if (s.tick % 25 === 0) {
      s.immunity.antibodies = clamp(s.immunity.antibodies + 10);
      emit(
        s,
        "antibody",
        cell.position,
        "漿細胞分泌特異性抗體；建立體液免疫支援，沒有直接殺菌傷害。",
        10,
        { actor: cell.id },
      );
    }
    return true;
  }
  if (role === "nk" || role === "cytotoxic") {
    const host = s.hosts
      .filter(
        (h) =>
          validHostTarget(cell, h, c) &&
          (cell.order.type !== "attack" || h.id === cell.order.target) &&
          dist(h.position, cell.position) <= c.cells[cell.kind].range,
      )
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (host && s.tick >= cell.readyAt) {
      cell.readyAt = s.tick + c.cells[cell.kind].cooldown;
      cell.path = [];
      cell.order = { type: "guard", point: { ...cell.position } };
      host.load = 0;
      host.apoptoticAt = s.tick;
      emit(
        s,
        "cytotoxic",
        host.position,
        `${c.cells[cell.kind].name}形成免疫突觸，穿孔素協助顆粒酶進入，誘導宿主凋亡；胞外菌沒有受到傷害。`,
        1,
        { actor: cell.id, target: host.id, from: { ...cell.position } },
      );
    }
    return true;
  }
  return role === "regulatory";
}
