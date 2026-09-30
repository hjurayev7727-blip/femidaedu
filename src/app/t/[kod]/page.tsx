import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TestCard, type CardData } from "@/components/tests/test-card";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeCode, SHARE_CODE_RE, START_ERRORS } from "@/lib/user-tests";
import { claimGuestAttempts, currentActor } from "@/lib/user-tests-server";
import { startTest } from "../actions";

type Card = ({ ok: true } & CardData) | { ok: false; reason: string; title?: string };

async function loadCard(kod: string) {
  const code = normalizeCode(kod);
  if (!SHARE_CODE_RE.test(code)) return null;
  const actor = await currentActor();
  if (actor.userId) await claimGuestAttempts(actor.userId);
  const { data } = await createSupabaseAdmin().rpc("test_card", { p_code: code, p_user: actor.userId, p_guest: actor.guest });
  return { code, actor, card: data as Card | null };
}

export async function generateMetadata({ params }: PageProps<"/t/[kod]">): Promise<Metadata> {
  const { kod } = await params;
  const r = await loadCard(kod);
  const title = r?.card?.ok ? r.card.title : "Test";
  // Ulashilgan testlar qidiruv tizimida indekslanmaydi (katalog — alohida)
  return { title, robots: { index: false }, openGraph: { title: `${title} — Femida Edu testi` } };
}

export default async function SharedTestPage({ params }: PageProps<"/t/[kod]">) {
  const { kod } = await params;
  const r = await loadCard(kod);
  if (!r) notFound();
  const { code, actor, card } = r;
  const loginHref = `/kirish?keyin=${encodeURIComponent(`/t/${code}`)}`;

  if (!card?.ok) {
    const reason = card?.reason ?? "not_found";
    return (
      <div className="card space-y-3 text-center">
        <p className="text-5xl" aria-hidden>{reason === "not_found" ? "🔍" : "🔒"}</p>
        {card && "title" in card && card.title && <h1 className="text-2xl font-bold">{card.title}</h1>}
        <p className="font-semibold">{START_ERRORS[reason] ?? START_ERRORS.not_found}</p>
        {reason === "login_required" ? <Link href={loginHref} className="btn-primary">Kirish</Link> : <Link href="/t" className="btn-ghost">Katalogga</Link>}
      </div>
    );
  }
  // eslint-disable-next-line react-hooks/purity -- server komponenti: har so'rovda joriy vaqt
  const now = Date.now();
  return <TestCard card={card} signedIn={Boolean(actor.userId)} action={startTest} loginHref={loginHref} now={now} />;
}
