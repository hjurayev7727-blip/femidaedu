"use server";
// Faqat /dev/jonli namunasi uchun: serverga yozmaydigan soxta amallar. Production'da ishlamaydi.
/* eslint-disable @typescript-eslint/no-unused-vars -- soxta amallar imzoni haqiqiylari bilan bir xil */
import type { LiveResult } from "@/lib/live-server";

const dev = () => {
  if (process.env.NODE_ENV === "production") throw new Error("dev only");
};
export async function demoAnswer(_room: string, _item: number, _r: unknown): Promise<LiveResult<null>> {
  dev();
  return { ok: true, value: null };
}
export async function demoControl(_room: string, _a: "next" | "reveal" | "finish"): Promise<boolean> {
  dev();
  return true;
}
export async function demoJoin(_p: { message: string } | null, _f: FormData): Promise<{ message: string } | null> {
  dev();
  return { message: "DEV: namuna — qo'shilmaydi." };
}
