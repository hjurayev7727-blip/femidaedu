"use server";
// Faqat /dev/testlar namunasi uchun: serverga yozmaydigan soxta amallar. Production'da ishlamaydi.
/* eslint-disable @typescript-eslint/no-unused-vars -- soxta amallar imzoni haqiqiylari bilan bir xil */
import type { FormState } from "@/app/app/testlar/actions";
import type { StartState } from "@/app/t/actions";
import type { TestAnswerResult } from "@/lib/user-tests-server";

const dev = () => {
  if (process.env.NODE_ENV === "production") throw new Error("dev only");
};
export async function demoForm(_prev: FormState, _form: FormData): Promise<FormState> {
  dev();
  return { ok: true, message: "DEV: saqlandi (namuna)." };
}
export async function demoSave(_t: number, _i: number | null, _input: unknown): Promise<FormState> {
  dev();
  return { ok: true, message: "DEV: saqlandi (namuna)." };
}
export async function demoRemove(_t: number, _i: number): Promise<FormState> {
  dev();
  return { ok: true, message: "DEV: olib tashlandi (namuna)." };
}
export async function demoStart(_prev: StartState, _form: FormData): Promise<StartState> {
  dev();
  return { message: "DEV: namuna — boshlanmaydi." };
}
export async function demoAnswer(_a: string, itemId: number, _r: unknown): Promise<TestAnswerResult> {
  dev();
  return { ok: true, revealed: true, correct: itemId % 2 === 1, answer: { index: 1 }, explanation: "Namuna izoh: to'g'ri javob B." };
}
export async function demoFinish(_c: string, _a: string): Promise<void> {
  dev();
}
