import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { displayName, verifyLoginWidget, verifyWebAppInitData } from "@/lib/telegram";

const TOKEN = "123456:TEST-bot-token";
const NOW = 1_790_000_000;

// Imzolashni mustaqil (hujjatdagi ta'rif bo'yicha) qayta yozamiz — kod o'zini o'zi tasdiqlamasin
function signWidget(fields: Record<string, string>) {
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const hash = createHmac("sha256", createHash("sha256").update(TOKEN).digest()).update(dcs).digest("hex");
  return { ...fields, hash };
}

function signWebApp(fields: Record<string, string>) {
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const key = createHmac("sha256", "WebAppData").update(TOKEN).digest();
  const hash = createHmac("sha256", key).update(dcs).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const widget = { id: "777", first_name: "Ali", last_name: "Valiyev", username: "ali", auth_date: String(NOW - 60) };

describe("Login Widget", () => {
  it("to'g'ri imzoni qabul qiladi", () => {
    expect(verifyLoginWidget(signWidget(widget), TOKEN, NOW)).toEqual({
      id: 777,
      first_name: "Ali",
      last_name: "Valiyev",
      username: "ali",
      photo_url: undefined,
    });
  });

  it("URLSearchParams bilan ham ishlaydi", () => {
    expect(verifyLoginWidget(new URLSearchParams(signWidget(widget)), TOKEN, NOW)?.id).toBe(777);
  });

  it("URL'dagi o'zimizning parametrlar (?keyin=) imzoni buzmaydi", () => {
    const q = new URLSearchParams({ keyin: "/app/mashq", ...signWidget(widget) });
    expect(verifyLoginWidget(q, TOKEN, NOW)?.id).toBe(777);
  });

  it("o'zgartirilgan maydonni rad etadi", () => {
    expect(verifyLoginWidget({ ...signWidget(widget), id: "1" }, TOKEN, NOW)).toBeNull();
  });

  it("boshqa bot tokenini rad etadi", () => {
    expect(verifyLoginWidget(signWidget(widget), "999:other", NOW)).toBeNull();
  });

  it("eskirgan (24 soatdan oshgan) ma'lumotni rad etadi", () => {
    expect(verifyLoginWidget(signWidget({ ...widget, auth_date: String(NOW - 90_000) }), TOKEN, NOW)).toBeNull();
  });

  it("hash yo'q yoki buzuq bo'lsa rad etadi", () => {
    expect(verifyLoginWidget(widget, TOKEN, NOW)).toBeNull();
    expect(verifyLoginWidget({ ...widget, hash: "zz" }, TOKEN, NOW)).toBeNull();
  });
});

describe("Mini App initData", () => {
  const user = JSON.stringify({ id: 42, first_name: "Vali", username: "vali" });
  const fields = { query_id: "AAH", user, auth_date: String(NOW - 5), signature: "abc" };

  it("to'g'ri imzoni qabul qiladi (signature maydoni bilan)", () => {
    expect(verifyWebAppInitData(signWebApp(fields), TOKEN, NOW)).toMatchObject({ id: 42, first_name: "Vali" });
  });

  it("Login Widget algoritmi bilan imzolanganini rad etadi", () => {
    const wrong = new URLSearchParams(signWidget(fields)).toString();
    expect(verifyWebAppInitData(wrong, TOKEN, NOW)).toBeNull();
  });

  it("user maydoni o'zgartirilsa rad etadi", () => {
    const tampered = signWebApp(fields).replace("Vali", "Hacker");
    expect(verifyWebAppInitData(tampered, TOKEN, NOW)).toBeNull();
  });
});

describe("displayName", () => {
  it("ism-familiya, username yoki id", () => {
    expect(displayName({ id: 1, first_name: "Ali", last_name: "V" })).toBe("Ali V");
    expect(displayName({ id: 1, first_name: "", username: "ali" })).toBe("@ali");
    expect(displayName({ id: 5, first_name: "" })).toBe("Telegram 5");
  });
});
