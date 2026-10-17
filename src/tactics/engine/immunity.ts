import { coat } from "./opsonization";
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
export function initialImmunity(c: TacticalContent, autoSeek = true): Immunity {
  return {
    autoSeek,
    signals: Object.fromEntries(
      c.fields.map((f) => [
        f.id,
        {
          cxcl8: 0,
          il12: 0,
          ifng: 0,
          il10: 0,
          inflammation: 0,
          ifni: 0,
          il17: 0,
          il22: 0,
        },
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
  if (
    host.load <= 0 ||
    host.infection?.phase === "latent" ||
    host.infection?.phase === "eclipse"
  )
    return false;
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
    node.crossPresented =
      c.mechanics === "viral" || c.mechanics === "retroviral";
    emit(
      s,
      "present",
      nodePoint(c),
      c.mechanics === "viral" || c.mechanics === "retroviral"
        ? "淋巴結：DC 呈遞 MHC-II 肽給 CD4，另以交叉呈遞的 MHC-I 病毒肽及共刺激啟動相符 CD8。"
        : "淋巴結：MHC-II／蛋白肽及共刺激已就緒；相符 CD4 T 可活化。這不是 MHC-I 交叉呈遞，不會直接活化 CD8。",
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
          cell.kind !== "tfh" &&
          cell.kind !== "th17" &&
          dist(cell.position, nodePoint(c)) > 2.1) ||
        (role === "nk" && signal.il12 >= 15)
      ) {
        signal.ifng = clamp(
          signal.ifng +
            10 *
              (c.mechanics === "retroviral" && role === "helper"
                ? (s.campaign?.cd4 ?? 100) / 100
                : 1),
        );
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
      if (cell.kind === "treg") {
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
      if (
        internal &&
        s.tick % 15 === 0 &&
        (c.mechanics !== "containment" || internal.load > 2)
      ) {
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
      coat(p, "antibody", s.tick + 30);
      emit(
        s,
        "mark",
        p.position,
        c.mechanics === "viral" || c.mechanics === "retroviral"
          ? "新生特異性抗體結合胞外病毒，阻斷受體接合；不進入宿主核內清除來源。"
          : "新生特異性抗體結合蛋白抗原，經 Fc 受體與補體促進調理；仍須吞噬者接觸清除。",
        30,
        {
          target: p.id,
          opsonin: "antibody",
          from: {
            ...(s.cells.find((u) => u.kind === "plasma")?.position ??
              nodePoint(c)),
          },
        },
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
  if (
    (role === "helper" ||
      role === "bcell" ||
      (role === "cytotoxic" && s.immunity.node.crossPresented)) &&
    cell.activation !== "effector"
  )
    return {
      x: nodePoint(c).x + (role === "bcell" ? 0.65 : -0.65),
      z: nodePoint(c).z,
    };
  if (cell.kind === "tfh") return nodePoint(c);
  if (
    (cell.kind === "pdc" ||
      cell.kind === "ilc3" ||
      (cell.kind === "th17" && cell.activation === "effector")) &&
    s.immunity.autoSeek
  )
    return [...s.colonies].sort(
      (a, b) =>
        dist(cell.position, a.position) - dist(cell.position, b.position),
    )[0]?.position;
  if (
    cell.kind === "helperT" &&
    cell.activation === "effector" &&
    s.cells.some((u) => u.kind === "bcell" && u.activation !== "effector")
  )
    return nodePoint(c);
  if (
    role === "helper" &&
    cell.activation === "effector" &&
    cell.kind !== "th17"
  ) {
    const infected = s.cells
      .filter(
        (u) =>
          u.kind === "macrophage" &&
          s.internal.some((p) => p.host === u.id && p.stage === "persistent"),
      )
      .sort(
        (a, b) =>
          dist(cell.position, a.position) - dist(cell.position, b.position),
      )[0];
    if (infected) return infected.position;
  }
  if (role === "presenter" && !cell.antigen && s.immunity.autoSeek) {
    const infected = s.cells
      .filter((u) => s.internal.some((p) => p.host === u.id && p.load > 0))
      .sort(
        (a, b) =>
          dist(a.position, cell.position) - dist(b.position, cell.position),
      )[0];
    if (
      infected &&
      !s.colonies.some((p) => p.load > 0 && dist(p.position, cell.position) < 5)
    )
      return infected.position;
  }
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
  if (
    role === "presenter" &&
    !cell.antigen &&
    s.cells.some(
      (u) =>
        u.id !== cell.id &&
        dist(u.position, cell.position) < 3 &&
        s.internal.some((p) => p.host === u.id && p.load > 0),
    )
  ) {
    cell.antigen = c.pathogen.antigen ?? `${c.pathogen.id}:protein`;
    if (node.stage === "idle") {
      node.stage = "migrating";
      node.antigen = cell.antigen;
    }
    emit(
      s,
      "present",
      cell.position,
      "樹突細胞於感染焦點取得抗原材料，成熟後引流至淋巴結；未直接消除感染巨噬細胞。",
      1,
      { actor: cell.id },
    );
  }
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
  if (
    role === "helper" ||
    role === "bcell" ||
    (role === "cytotoxic" &&
      node.crossPresented &&
      cell.activation !== "effector")
  ) {
    if (!cell.activation || cell.activation === "resting") {
      const helper = s.cells.find(
        (u) =>
          c.cells[u.kind].role === "helper" &&
          u.kind !== "th1" &&
          u.kind !== "th17" &&
          u.activation === "effector" &&
          u.antigen === node.antigen &&
          dist(u.position, nodePoint(c)) <= 3 &&
          dist(u.position, cell.position) <= 2.1,
      );
      if (
        (c.mechanics !== "retroviral" || (s.campaign?.cd4 ?? 100) >= 25) &&
        inNode &&
        node.stage === "primed" &&
        (!cell.antigen || cell.antigen === node.antigen) &&
        (role !== "bcell" || helper)
      ) {
        if (role === "bcell" && helper) {
          if (cell.partner !== helper.id) {
            cell.partner = helper.id;
            cell.dockAt = s.tick + 15;
            cell.antigen = node.antigen;
            emit(
              s,
              "dock",
              cell.position,
              "B 細胞呈遞相同來源的蛋白肽／MHC-II；Tfh 近距離辨識並提供 CD40L／CD40 與細胞激素協助。對接後仍需分化等待。",
              1,
              {
                actor: helper.id,
                target: cell.id,
                from: { ...helper.position },
              },
            );
          }
          if (s.tick < (cell.dockAt ?? Infinity)) return true;
        }
        cell.activation = "activating";
        cell.antigen = node.antigen;
        cell.activationAt =
          s.tick +
          (role === "bcell" ? 50 : 40) +
          (c.mechanics === "retroviral"
            ? Math.round((100 - (s.campaign?.cd4 ?? 100)) * 0.5)
            : 0);
        emit(
          s,
          "activate",
          nodePoint(c),
          role !== "bcell"
            ? role === "cytotoxic"
              ? "相符 CD8 T 接受 DC 交叉呈遞的 MHC-I 肽／共刺激，開始擴增分化。"
              : "相符 CD4 T 接受 MHC-II 肽／共刺激，開始擴增分化（8 秒教學壓縮）。"
            : "B 細胞結合相符蛋白抗原並接受已活化 T 細胞幫助，開始向漿細胞分化（10 秒壓縮）。",
          1,
          { actor: cell.id },
        );
      } else if (role === "bcell") {
        delete cell.partner;
        delete cell.dockAt;
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
          : `${c.cells[cell.kind].name}已活化，依其亞群及相符抗原執行效應；不直接清除所有種類的病原。`,
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
        `${c.cells[cell.kind].name}形成免疫突觸，穿孔素協助顆粒酶進入，誘導宿主凋亡；胞外病原仍獨立存在，未被一併清除。`,
        1,
        { actor: cell.id, target: host.id, from: { ...cell.position } },
      );
    }
    return true;
  }
  return role === "regulatory";
}
