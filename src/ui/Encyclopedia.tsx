import { useState } from "react";
import { entries, sources } from "../content/encyclopedia";
import { Dialog } from "./Dialog";
export function Encyclopedia({
  initial = "",
  read,
  onRead,
  onClose,
}: {
  initial?: string;
  read: string[];
  onRead: (id: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(
    entries.find((e) => e.id === initial) || entries[0],
  );
  const results = entries.filter((e) =>
    (e.name + e.english + e.keywords + e.summary)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <Dialog title="微觀百科" onClose={onClose} wide>
      <div className="encyclopedia">
        <aside>
          <label className="search-label">
            搜尋機制、細胞與病原
            <input
              type="search"
              aria-label="搜尋百科"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="例如：調理、Th1、囊泡…"
            />
          </label>
          <nav className="entry-list" aria-label="百科條目">
            {results.map((e) => (
              <button
                key={e.id}
                aria-label={e.name}
                aria-current={active.id === e.id ? "page" : undefined}
                onClick={() => {
                  setActive(e);
                  onRead(e.id);
                }}
              >
                <span>{e.name}</span>
                <small>{read.includes(e.id) ? "已讀" : "可查閱"}</small>
              </button>
            ))}
            {!results.length && <p>沒有符合的條目。</p>}
          </nav>
        </aside>
        <article className="entry-detail">
          <span className="eyebrow">IMMUNE ATLAS</span>
          <h3>{active.name}</h3>
          <p className="latin">{active.english}</p>
          <p className="entry-summary">{active.summary}</p>
          <h4>機制與協作</h4>
          <p>{active.mechanism}</p>
          <h4>遊戲簡化與實作範圍</h4>
          <p>{active.scope}</p>
          <h4>機制來源</h4>
          {active.sources.map((id) => (
            <a
              className="source-link"
              key={id}
              href={sources[id].url}
              target="_blank"
              rel="noreferrer"
            >
              ↗ {sources[id].name}
            </a>
          ))}
          <p className="fine-print">
            圖像並非真實比例；遊戲不作醫療建議或疾病預測。
          </p>
        </article>
      </div>
    </Dialog>
  );
}
