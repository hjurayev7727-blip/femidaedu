"use client";
import type {
  Answer,
  ChoicePayload,
  ClientQuestion,
  MatchingAnswer,
  MatchingPayload,
  OpenPayload,
  OrderingAnswer,
  OrderingPayload,
  QuestionType,
  Response,
} from "@/lib/questions";

const LETTERS = "ABCDEFGHIJ";

const TYPE_LABEL: Record<QuestionType, string> = {
  single: "Test",
  multi: "Bir nechta javob",
  fill_blank: "Bo'sh joyni to'ldiring",
  case: "Amaliy vaziyat",
  matching: "Moslashtiring",
  ordering: "Tartiblang",
  open: "Yozma javob",
};

type Props = {
  question: ClientQuestion;
  response: Response | null;
  onChange: (r: Response) => void;
  /** javobdan keyin — to'g'ri javob (ko'rsatish rejimi) */
  reveal: Answer | null;
  disabled: boolean;
};

/** Javob to'liq kiritilganmi (yuborish tugmasini yoqish uchun) */
export function isComplete(q: ClientQuestion, r: Response | null): boolean {
  if (!r) return false;
  switch (q.type) {
    case "matching":
      return "map" in r && r.map.length === (q.payload as MatchingPayload).left.length && r.map.every((x) => x >= 0);
    case "ordering":
      return "order" in r;
    case "open":
      return "text" in r && r.text.trim().length > 0;
    case "multi":
      return "indexes" in r && r.indexes.length > 0;
    default:
      return "index" in r;
  }
}

/** Boshlang'ich javob holati (tartiblash — ko'rsatilgan tartib) */
export function initialResponse(q: ClientQuestion): Response | null {
  if (q.type === "ordering") return { order: (q.payload as OrderingPayload).items.map((_, i) => i) };
  if (q.type === "matching") return { map: (q.payload as MatchingPayload).left.map(() => -1) };
  return null;
}

export function QuestionView({ question: q, response, onChange, reveal, disabled }: Props) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="tag">{TYPE_LABEL[q.type]}</span>
        <span className="text-xs font-bold text-mute" aria-label={`Qiyinlik ${q.difficulty}`}>
          {"●".repeat(q.difficulty)}
          <span className="opacity-30">{"●".repeat(3 - q.difficulty)}</span>
        </span>
      </div>

      {q.context && (
        <p className="mt-4 rounded-r-xl border-l-4 border-amber bg-amber-soft px-4 py-3 text-[15px] leading-relaxed">{q.context}</p>
      )}
      <h2 className="mt-4 text-[17px] font-bold leading-snug tracking-tight">{q.stem}</h2>

      <div className="mt-5">
        {(q.type === "single" || q.type === "fill_blank" || q.type === "case") && (
          <Choice payload={q.payload as ChoicePayload} value={response && "index" in response ? response.index : null}
            onPick={(index) => onChange({ index })} correct={reveal && "index" in reveal ? reveal.index : null} disabled={disabled} />
        )}
        {q.type === "matching" && (
          <Matching payload={q.payload as MatchingPayload} value={response && "map" in response ? response.map : []}
            onChange={(map) => onChange({ map })} reveal={reveal as MatchingAnswer | null} disabled={disabled} />
        )}
        {q.type === "ordering" && (
          <Ordering payload={q.payload as OrderingPayload} value={response && "order" in response ? response.order : []}
            onChange={(order) => onChange({ order })} reveal={reveal as OrderingAnswer | null} disabled={disabled} />
        )}
        {q.type === "open" && (
          <input
            className="w-full rounded-[14px] border-2 border-line bg-card px-4 py-3.5 text-[15px] font-semibold outline-none focus:border-cyan"
            placeholder={(q.payload as OpenPayload).kind === "article" ? "Modda raqami…" : (q.payload as OpenPayload).kind === "number" ? "Raqam…" : "Javobingiz…"}
            value={response && "text" in response ? response.text : ""}
            onChange={(e) => onChange({ text: e.target.value })}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
}

function Choice({ payload, value, onPick, correct, disabled }: {
  payload: ChoicePayload; value: number | null; onPick: (i: number) => void; correct: number | null; disabled: boolean;
}) {
  return (
    <>
      {payload.statements && (
        <ol className="mb-4 space-y-1.5 rounded-xl bg-bg px-4 py-3 text-[15px]">
          {payload.statements.map((s, i) => (
            <li key={i}><b className="text-cyan-2">{i + 1}.</b> {s}</li>
          ))}
        </ol>
      )}
      <div className="grid gap-2.5" role="radiogroup">
        {payload.options.map((opt, i) => {
          const state = correct == null ? (value === i ? "picked" : "idle")
            : i === correct ? "ok" : value === i ? "no" : "idle";
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={value === i}
              disabled={disabled}
              onClick={() => onPick(i)}
              className={`flex items-center gap-3 rounded-[14px] border-2 px-4 py-3.5 text-left text-[15px] font-semibold transition
                ${state === "ok" ? "border-ok bg-ok-soft" : state === "no" ? "border-no bg-no-soft"
                  : state === "picked" ? "border-cyan bg-cyan-soft" : "border-line bg-card enabled:hover:border-cyan enabled:hover:bg-cyan-soft"}`}
            >
              <span className={`flex h-[26px] min-w-[26px] items-center justify-center rounded-lg text-[12.5px] font-extrabold text-white
                ${state === "ok" ? "bg-ok" : state === "no" ? "bg-no" : state === "picked" ? "bg-cyan-2" : "bg-graf-3"}`}>
                {LETTERS[i]}
              </span>
              <span className="flex-1">{opt}</span>
              {state === "ok" && <span className="font-black text-ok" aria-label="to'g'ri">✓</span>}
              {state === "no" && <span className="font-black text-no" aria-label="xato">✕</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

function Matching({ payload, value, onChange, reveal, disabled }: {
  payload: MatchingPayload; value: number[]; onChange: (m: number[]) => void; reveal: MatchingAnswer | null; disabled: boolean;
}) {
  return (
    <div className="space-y-2.5">
      {payload.left.map((l, i) => {
        const v = value[i] ?? -1;
        const state = reveal ? (reveal.map[i] === v ? "ok" : "no") : "idle";
        return (
          <div key={i} className={`rounded-[14px] border-2 p-3 ${state === "ok" ? "border-ok bg-ok-soft" : state === "no" ? "border-no bg-no-soft" : "border-line bg-card"}`}>
            <p className="text-[15px] font-bold">{l}</p>
            <select
              aria-label={`${l} uchun moslik`}
              className="mt-2 w-full rounded-xl border-2 border-line bg-card px-3 py-2.5 text-[14.5px] font-semibold outline-none focus:border-cyan"
              value={v}
              disabled={disabled}
              onChange={(e) => onChange(payload.left.map((_, j) => (j === i ? Number(e.target.value) : value[j] ?? -1)))}
            >
              <option value={-1}>Tanlang…</option>
              {payload.right.map((r, j) => (
                <option key={j} value={j}>{r}</option>
              ))}
            </select>
            {state === "no" && reveal && (
              <p className="mt-1.5 text-sm font-semibold text-ok">To&apos;g&apos;ri: {payload.right[reveal.map[i]]}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Ordering({ payload, value, onChange, reveal, disabled }: {
  payload: OrderingPayload; value: number[]; onChange: (o: number[]) => void; reveal: OrderingAnswer | null; disabled: boolean;
}) {
  const move = (pos: number, dir: -1 | 1) => {
    const next = [...value];
    const to = pos + dir;
    if (to < 0 || to >= next.length) return;
    [next[pos], next[to]] = [next[to], next[pos]];
    onChange(next);
  };
  return (
    <ol className="space-y-2">
      {value.map((itemIdx, pos) => {
        const state = reveal ? (reveal.order[pos] === itemIdx ? "ok" : "no") : "idle";
        return (
          <li key={itemIdx} className={`flex items-center gap-3 rounded-[14px] border-2 px-3 py-2.5 ${state === "ok" ? "border-ok bg-ok-soft" : state === "no" ? "border-no bg-no-soft" : "border-line bg-card"}`}>
            <span className="flex h-[26px] min-w-[26px] items-center justify-center rounded-lg bg-graf-3 text-[12.5px] font-extrabold text-white">{pos + 1}</span>
            <span className="flex-1 text-[15px] font-semibold">{payload.items[itemIdx]}</span>
            {!disabled && (
              <span className="flex flex-col">
                <button type="button" onClick={() => move(pos, -1)} disabled={pos === 0} aria-label="Yuqoriga" className="px-2 leading-none text-mute enabled:hover:text-cyan-2 disabled:opacity-30">▲</button>
                <button type="button" onClick={() => move(pos, 1)} disabled={pos === value.length - 1} aria-label="Pastga" className="px-2 leading-none text-mute enabled:hover:text-cyan-2 disabled:opacity-30">▼</button>
              </span>
            )}
          </li>
        );
      })}
      {reveal && value.some((v, i) => reveal.order[i] !== v) && (
        <li className="pt-1 text-sm font-semibold text-ok">To&apos;g&apos;ri tartib: {reveal.order.map((i) => payload.items[i]).join(" → ")}</li>
      )}
    </ol>
  );
}
