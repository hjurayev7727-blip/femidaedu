"use client";
import { useState } from "react";
import { initialResponse, isComplete, QuestionView } from "@/components/question/question-view";
import { gradeResponse, type Answer, type ClientQuestion, type Response } from "@/lib/questions";

type Item = { question: ClientQuestion; answer: Answer; explanation: string | null; sourceNote: string | null };

export function Demo({ items }: { items: Item[] }) {
  return (
    <div className="space-y-6">
      {items.map((it) => (
        <One key={it.question.id} item={it} />
      ))}
    </div>
  );
}

function One({ item }: { item: Item }) {
  const [response, setResponse] = useState<Response | null>(() => initialResponse(item.question));
  const [checked, setChecked] = useState(false);
  const grade = checked && response ? gradeResponse(item.question.type, item.question.payload, item.answer, response) : null;

  return (
    <div className="card" data-type={item.question.type}>
      <QuestionView question={item.question} response={response} onChange={setResponse} reveal={checked ? item.answer : null} disabled={checked} />
      {grade && (
        <div className="mt-4 space-y-2">
          <p className={`font-extrabold ${grade.correct ? "text-ok" : "text-no"}`}>{grade.correct ? "To'g'ri! ✓" : "Xato ✕"}</p>
          {item.explanation && <p className="rounded-r-xl border-l-4 border-brand bg-brand-soft px-4 py-3 text-[15px]">{item.explanation}</p>}
          {item.sourceNote && <p className="text-xs text-mute">📖 {item.sourceNote}</p>}
        </div>
      )}
      <div className="mt-4 flex gap-2">
        {!checked ? (
          <button className="btn-primary w-full" disabled={!isComplete(item.question, response)} onClick={() => setChecked(true)}>
            Javobni tekshirish
          </button>
        ) : (
          <button className="btn-ghost w-full" onClick={() => { setChecked(false); setResponse(initialResponse(item.question)); }}>
            Qayta
          </button>
        )}
      </div>
    </div>
  );
}
