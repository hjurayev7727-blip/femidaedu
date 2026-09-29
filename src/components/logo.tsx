import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-white">
      <span className="bg-accent rounded-[11px] px-2.5 py-1 text-lg font-extrabold shadow-[0_4px_14px_-4px_rgba(6,182,212,.7)]">
        A+
      </span>
      <span className="text-[17px] font-extrabold tracking-tight">Huquq</span>
    </Link>
  );
}
