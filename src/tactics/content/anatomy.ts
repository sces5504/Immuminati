import type {
  HostCell,
  TacticalContent,
  TacticalState,
  TissueCellKind,
} from "../domain/model";

export const tissueCellCatalog: Record<
  TissueCellKind,
  { name: string; function: string; color: number }
> = {
  enterocyte: {
    name: "腸吸收上皮細胞",
    function: "柱狀上皮與刷狀緣構成腸黏膜屏障。",
    color: 0xe4b1a8,
  },
  goblet: {
    name: "杯狀細胞",
    function: "分泌黏液，協助限制病原接近上皮。",
    color: 0xbacfd0,
  },
  cd4host: {
    name: "CD4 T 宿主細胞",
    function: "具 CD4 與共受體的易感宿主；潛伏與產毒是不同狀態。",
    color: 0x9cc0b7,
  },
  stromal: {
    name: "淋巴網狀基質細胞",
    function: "支持淋巴組織的結構與免疫細胞互動。",
    color: 0xc3a9c6,
  },
  alveolarI: {
    name: "第一型肺泡上皮細胞",
    function: "薄而展開，構成主要氣體交換表面與上皮屏障。",
    color: 0xd5a6b8,
  },
  alveolarII: {
    name: "第二型肺泡上皮細胞",
    function: "分泌表面活性物質，並參與肺泡上皮修復；本版不模擬再生。",
    color: 0xd99cb4,
  },
  endothelial: {
    name: "微血管內皮細胞",
    function: "構成血管壁；募集細胞需穿越內皮、間質及肺泡上皮，才能進入腔面。",
    color: 0xbb8fae,
  },
  mucosal: {
    name: "黏膜上皮細胞",
    function: "構成黏膜屏障；依部位提供不同的局部防禦。",
    color: 0xe2abb6,
  },
};
export const compartmentNames = {
  extracellular: "細胞外",
  phagosome: "吞噬體內",
  cytosol: "細胞質內",
  nucleus: "細胞核內",
} as const;

/** Shared cell layout, independent of pathogens and rendering. No new campaign levels. */
export function populateTissue(s: TacticalState, c: TacticalContent) {
  for (const f of c.fields) {
    for (let i = 0; i < 14; i++) {
      const angle = ((i + 0.5) / 14) * Math.PI * 2;
      const open =
        c.fields.some((other) => {
          if (other.id === f.id) return false;
          const direction = Math.atan2(
            other.center.z - f.center.z,
            other.center.x - f.center.x,
          );
          return (
            Math.abs(
              Math.atan2(
                Math.sin(angle - direction),
                Math.cos(angle - direction),
              ),
            ) < 0.48
          );
        }) ||
        (f.id === "c" && Math.abs(angle - Math.PI / 2) < 0.46);
      if (open) continue;
      const radius =
        f.radius +
        0.25 +
        0.55 * Math.sin(angle * 3 + f.center.x * 0.08) +
        0.3 * Math.cos(angle * 5 + 0.4);
      s.hosts.push({
        id: `h${s.serial++}`,
        region: f.id,
        position: {
          x: f.center.x + Math.cos(angle) * radius,
          z: f.center.z + Math.sin(angle) * radius,
        },
        kind:
          c.tissue === "lung"
            ? i % 5 === 0
              ? "alveolarII"
              : "alveolarI"
            : c.tissue === "intestinal"
              ? i % 5 === 0
                ? "goblet"
                : "enterocyte"
              : c.tissue === "lymphoid"
                ? i % 3 === 0
                  ? "stromal"
                  : "cd4host"
                : "mucosal",
        layer: c.tissue === "lymphoid" ? "lymphoid" : "epithelium",
        wall:
          c.tissue === "lung"
            ? { angle, radius, arc: ((Math.PI * 2) / 14) * 0.98 }
            : undefined,
        health: s.health[f.id],
        antigen: "self",
        mhc1: true,
        stressed: false,
        load: 0,
        apoptoticAt: 0,
      });
    }
  }
  const field = c.fields.reduce((a, b) =>
    Math.hypot(a.center.x - c.portal.x, a.center.z - c.portal.z) <
    Math.hypot(b.center.x - c.portal.x, b.center.z - c.portal.z)
      ? a
      : b,
  );
  for (let i = 0; i < 5; i++)
    s.hosts.push({
      id: `h${s.serial++}`,
      region: field.id,
      position: { x: c.portal.x - 6 + i * 3, z: c.portal.z + 0.8 },
      kind: "endothelial",
      layer: "vascular",
      health: s.health[field.id],
      antigen: "self",
      mhc1: true,
      stressed: false,
      load: 0,
      apoptoticAt: 0,
    });
}
/** Tissue health is the regional aggregate, not extra damage counted per visible cell. */
export function syncTissueHealth(s: TacticalState) {
  for (const host of s.hosts)
    host.health = host.apoptoticAt ? 0 : s.health[host.region];
}
export function hostStatus(host: HostCell) {
  return host.apoptoticAt
    ? "已凋亡"
    : host.load > 0
      ? `${compartmentNames[host.infection?.compartment ?? "cytosol"]} · ${host.infection?.phase === "latent" ? "潛伏（未呈遞病毒肽）" : host.infection?.phase === "eclipse" ? "感染建立中" : "感染"} · 活負荷 ${host.load}`
      : "未感染";
}
