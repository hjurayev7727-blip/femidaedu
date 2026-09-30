import Link from "next/link";
import type { FormState } from "@/app/app/testlar/actions";
import { fmtUz } from "@/lib/dates";
import type { TestSettings, Visibility } from "@/lib/user-tests";
import { ItemEditor, type EditorItem } from "./item-editor";
import { PublishPanel } from "./publish-panel";
import { SharePanel } from "./share-panel";

export type EditorTest = {
  id: number; title: string; description: string | null; share_code: string; visibility: Visibility; status: string;
  group_id: number | null; settings: Partial<TestSettings>; own_material: boolean; moderation: string | null; field_slug: string | null;
};
export type ResultRow = { attempt_id: string; name: string; guest: boolean; score: number | null; correct: number | null; total: number | null; started_at: string; finished_at: string | null; regraded: boolean };

type Actions = {
  saveMeta?: (form: FormData) => Promise<void>;
  saveItem: (testId: number, itemId: number | null, input: unknown) => Promise<FormState>;
  removeItem: (testId: number, itemId: number) => Promise<FormState>;
  publish: (prev: FormState, form: FormData) => Promise<FormState>;
  setStatus?: (form: FormData) => Promise<void>;
  startLive?: (form: FormData) => Promise<void>;
};

const field = "mt-1 w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-semibold outline-none focus:border-brand";
const time = (iso: string) => fmtUz(iso, { short: true });
const duration = (a: string, b: string | null) => (b ? `${Math.max(1, Math.round((+new Date(b) - +new Date(a)) / 60000))} daq` : "—");

/** Muallif sahifasi: savollar tahriri, nashr, ulashish, natijalar */
export function TestEditor(props: {
  test: EditorTest;
  items: EditorItem[];
  fields: { slug: string; title: string }[];
  groups: { id: number; name: string }[];
  trust: number;
  results: ResultRow[];
  links: { web: string; telegram: string | null };
  created?: number;
  liveError?: string;
  liveMax?: number;
  actions: Actions;
}) {
  const { test: t, items, actions } = props;
  const finished = props.results.filter((r) => r.finished_at);
  const avg = finished.length ? Math.round(finished.reduce((s, r) => s + Number(r.score ?? 0), 0) / finished.length) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <nav className="text-sm font-semibold text-mute"><Link href="/app/testlar" className="hover:underline">Testlar</Link> › {t.title}</nav>
      {props.created != null && (
        <p role="status" className="rounded-xl bg-ok-soft px-4 py-3 text-sm font-semibold text-ok">
          AI {props.created} ta savol tuzdi. Har birini tekshirib chiqing, keyin nashr qiling.
        </p>
      )}

      <form action={actions.saveMeta} className="card space-y-3">
        <input type="hidden" name="test" value={t.id} />
        <label className="block text-sm font-bold">Nomi
          <input name="title" defaultValue={t.title} required minLength={3} maxLength={120} className={`${field} text-lg`} />
        </label>
        <label className="block text-sm font-bold">Tavsif
          <textarea name="description" defaultValue={t.description ?? ""} maxLength={600} rows={2} className={field} />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-bold">Soha
            <select name="field" defaultValue={t.field_slug ?? ""} className={field}>
              <option value="">—</option>
              {props.fields.map((f) => <option key={f.slug} value={f.slug}>{f.title}</option>)}
            </select>
          </label>
          <button className="btn-ghost !py-2.5">Saqlash</button>
        </div>
        {t.own_material && (
          <p className="text-xs font-semibold text-amber">Ba&apos;zi savollar bazadagi moddaga bog&apos;lanmagan — test katalogga chiqmaydi, havola bilan ishlaydi.</p>
        )}
      </form>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Savollar ({items.length})</h2>
        {items.map((it, i) => (
          <ItemEditor key={it.id} testId={t.id} index={i} item={it} save={actions.saveItem} remove={actions.removeItem} />
        ))}
        {items.length < 50 && <ItemEditor testId={t.id} index={items.length} item={null} save={actions.saveItem} />}
      </section>

      <PublishPanel testId={t.id} status={t.status} visibility={t.visibility} groupId={t.group_id} settings={t.settings}
        groups={props.groups} trust={props.trust} moderation={t.moderation} action={actions.publish} />

      {t.status === "published" && <SharePanel code={t.share_code} web={props.links.web} telegram={props.links.telegram} title={t.title} />}

      {actions.startLive && items.length > 0 && (
        <form action={actions.startLive} className="card space-y-3">
          <input type="hidden" name="test" value={t.id} />
          <div>
            <h2 className="text-xl font-bold">🎮 Jonli viktorina</h2>
            <p className="text-sm text-mute">
              Sinfda proyektorga chiqaring: o&apos;quvchilar PIN yoki QR bilan telefondan qo&apos;shiladi, har savoldan keyin top-5.
              {props.liveMax ? ` ${props.liveMax} ishtirokchigacha.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-bold">Har savolga
              <select name="seconds" defaultValue={20} className={field}>
                {[10, 20, 30, 60].map((n) => <option key={n} value={n}>{n} soniya</option>)}
              </select>
            </label>
            {props.groups.length > 0 && (
              <label className="text-sm font-bold">Guruh (natija uchun)
                <select name="group" defaultValue="" className={field}>
                  <option value="">—</option>
                  {props.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
            )}
            <button className="btn-gold">▶ Xona ochish</button>
          </div>
          {props.liveError && <p role="alert" className="text-sm font-semibold text-no">{props.liveError}</p>}
        </form>
      )}

      <section className="card space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Natijalar</h2>
          <span className="text-sm text-mute">{finished.length} ta yakunlangan{avg != null ? ` · o'rtacha ${avg}%` : ""}</span>
        </div>
        {props.results.length === 0 ? (
          <p className="text-sm text-mute">Hali hech kim ishlamagan.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-mute">
                <tr><th className="py-2">Ishtirokchi</th><th>Ball</th><th>To&apos;g&apos;ri</th><th>Vaqt</th><th>Sana</th></tr>
              </thead>
              <tbody>
                {props.results.map((r) => (
                  <tr key={r.attempt_id} className="border-t border-line">
                    <td className="py-2 font-semibold">{r.name}{r.guest && <span className="ml-1 text-xs text-mute">(mehmon)</span>}</td>
                    <td className="font-bold tabular-nums">{r.finished_at ? `${Math.round(Number(r.score ?? 0))}%` : <span className="text-mute">jarayonda</span>}{r.regraded && <span title="Javob kaliti o'zgargach qayta hisoblangan" className="ml-1 text-xs text-amber">↻</span>}</td>
                    <td className="tabular-nums">{r.correct ?? 0}/{r.total ?? 0}</td>
                    <td className="tabular-nums">{duration(r.started_at, r.finished_at)}</td>
                    <td className="text-mute">{time(r.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {actions.setStatus && (
        <div className="flex flex-wrap gap-2">
          {t.status === "published" && (
            <form action={actions.setStatus}>
              <input type="hidden" name="test" value={t.id} /><input type="hidden" name="status" value="hidden" />
              <button className="rounded-lg px-3 py-2 text-sm font-bold text-mute hover:bg-line">Nashrdan olish</button>
            </form>
          )}
          <form action={actions.setStatus}>
            <input type="hidden" name="test" value={t.id} /><input type="hidden" name="status" value="removed" />
            <button className="rounded-lg px-3 py-2 text-sm font-bold text-no hover:bg-no-soft">Testni o&apos;chirish</button>
          </form>
        </div>
      )}
    </div>
  );
}
