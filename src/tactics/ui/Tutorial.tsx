import { useEffect, useState } from "react";
import type { TacticalSave } from "../domain/model";
const steps = [
  {
    title: "把時間停下來",
    text: "上方「戰術暫停／開始行動」控制時間。暫停時不受損，可以安排多個指令並撤銷。現在保持暫停。",
    target: '[data-testid="pause-toggle"]',
  },
  {
    title: "選擇免疫細胞",
    text: "點下方單位清單的巨噬細胞。場上模型與清單都能選取，底部會顯示它的功能。",
    target: '[data-cell-id="u1"]',
  },
  {
    title: "調度到另一防區",
    text: "選取細胞後，點「深部肺泡」地標，下達沿組織通道移動的命令。也能點地面指定位置。",
    target: '[aria-label="防區深部肺泡"]',
  },
  {
    title: "開啟自動尋敵",
    text: "按「自動尋敵」。空閒吞噬者會找最近的細菌，手動移動仍優先；B 細胞等則依自身機制行動。",
    target: '[data-testid="autoseek"]',
  },
  {
    title: "先調理，再吞噬",
    text: "按右側「調理支援」，再點一群活菌。C3b 附著後負荷不會立即下降，必須由吞噬者接近。花 1 資源，持續 20 秒。",
    target: '[data-testid="mark-tool"]',
  },
  {
    title: "募集嗜中性球",
    text: "開啟「募集增援」，選擇防區並點嗜中性球。需要 3 資源，從微血管延遲到場，不限同區數量。資源不足可略過，稍後再試。",
    target: '[data-testid="recruit-tool"]',
  },
  {
    title: "觀察自主吞噬",
    text: "關閉增援面板，按「開始／繼續行動」，等待細胞接近並吞噬。偽足包覆、吞入與清除由動畫呈現，規則不靠動畫回呼。",
    target: '[data-testid="pause-toggle"]',
  },
  {
    title: "試用 2×",
    text: "按戰場上的速度鍵切到 2×。它只加快固定步進與展示，不會重複扣資源；任何時候都能暫停。",
    target: '[data-testid="speed-toggle"]',
  },
  {
    title: "讀懂反應鏈",
    text: "按「免疫機制」觀察各區訊號與淋巴結。這裡可進入 NK／CD8 演練；因果紀錄可追查每次變化。閱讀後關閉面板。",
    target: '[data-testid="immune-panel"]',
  },
  {
    title: "守住組織，完成三波",
    text: "調理與募集都能支援防線；也可以延後清場，建立 CD4 T／B 抗體支援。所有防區需存活，組織保全決定星等。教學結束後保持暫停，由你開始行動。",
    target: '[data-testid="pause-toggle"]',
  },
];
export function Tutorial({
  save,
  selected,
  onClose,
  onStep,
  seenMechanisms,
  blocked,
}: {
  save: TacticalSave;
  selected?: string;
  onClose: () => void;
  onStep: (step: number) => void;
  seenMechanisms: boolean;
  blocked: boolean;
}) {
  const [step, setStep] = useState(0),
    [start, setStart] = useState(save.state.eventId);
  const s = save.state,
    events = s.events.filter((e) => e.id > start),
    item = steps[step];
  const done = [
    save.paused,
    !!selected && s.cells.some((u) => u.id === selected),
    events.some((e) => e.type === "move" && e.actor),
    s.immunity.autoSeek,
    events.some((e) => e.type === "mark"),
    events.some((e) => e.type === "request"),
    events.some((e) => e.type === "engulf"),
    save.settings.speed === 2,
    seenMechanisms,
    true,
  ][step];
  useEffect(() => {
    const el = document.querySelector(item.target);
    el?.classList.add("t-tutorial-target");
    return () => el?.classList.remove("t-tutorial-target");
  }, [step, item.target, blocked]);
  const next = () => {
    if (step === steps.length - 1) {
      onClose();
      return;
    }
    setStart(s.eventId);
    setStep(step + 1);
    onStep(step + 1);
  };
  return (
    <aside
      className="t-tutorial"
      data-tutorial-step={step}
      hidden={blocked}
      aria-label="互動操作教學"
    >
      <div>
        <small>
          實際操作教學 · {step + 1}/{steps.length}
        </small>
        <button onClick={onClose} aria-label="結束教學">
          ×
        </button>
      </div>
      <h3>{item.title}</h3>
      <p>{item.text}</p>
      <footer>
        <button onClick={next}>略過此步</button>
        <button disabled={!done} onClick={next}>
          {step === steps.length - 1
            ? "完成教學"
            : done
              ? "已完成，下一步 →"
              : "請完成操作"}
        </button>
      </footer>
    </aside>
  );
}
