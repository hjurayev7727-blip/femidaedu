import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChatRoom } from "@/components/chat/chat-room";
import { VerifiedBadge } from "@/components/lawyers/lawyer-card";
import { requireUser } from "@/lib/auth";
import { chatPoll, conversationInfo } from "@/lib/chat-server";
import { declineAction, offerAction, sendAction } from "../actions";

export const metadata: Metadata = { title: "Suhbat" };

export default async function ConversationPage({ params }: PageProps<"/app/suhbatlar/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { userId } = await requireUser();
  const [info, poll] = await Promise.all([conversationInfo(userId, id), chatPoll(userId, id, 0)]);
  if (!info || !poll.ok) notFound();
  const other = info.role === "client" ? info.lawyer_name : info.client_name;

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <nav className="text-sm font-semibold text-mute"><Link href="/app/suhbatlar" className="hover:underline">Suhbatlar</Link> › {other}</nav>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">
          {info.role === "client" ? <Link href={`/app/yuristlar/${info.lawyer_id}`} className="hover:underline">{other}</Link> : other}
        </h1>
        {info.role === "client" && <VerifiedBadge verified={info.lawyer_verified} />}
      </div>
      {info.request && (
        <details className="card !p-4">
          <summary className="cursor-pointer font-bold">📩 Ariza: {info.request.title}</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm">{info.request.body}</p>
          {info.request.ai_snapshot && (
            <div className="mt-2 rounded-xl bg-bg p-3 text-sm">
              <p className="text-xs font-bold text-mute">AI yordamchi javobi (mijoz bilan ulashilgan):</p>
              <p className="mt-1 whitespace-pre-wrap">{info.request.ai_snapshot}</p>
            </div>
          )}
        </details>
      )}
      <ChatRoom conv={id} role={info.role} otherName={other}
        initial={{ messages: poll.messages, offers: poll.offers, otherRead: poll.other_read, paid: poll.paid }}
        send={sendAction} offer={offerAction} decline={declineAction}
        blocked={info.lawyer_status === "blocked"} payReady={false} />
    </div>
  );
}
