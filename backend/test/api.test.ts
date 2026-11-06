import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";

const mrAgent = request.agent(app);
const officerAgent = request.agent(app);

beforeAll(async () => {
  const login = await mrAgent
    .post("/api/auth/login")
    .send({ username: "mr.admin", password: "JxbMr2024!" });
  expect(login.status).toBe(200);

  const officerLogin = await officerAgent
    .post("/api/auth/login")
    .send({ username: "officer.brc01", password: "JxbMr2024!" });
  expect(officerLogin.status).toBe(200);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("health & autentikasi", () => {
  it("health check tersedia tanpa login", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });

  it("menolak akses tanpa sesi", async () => {
    const res = await request(app).get("/api/risks");
    expect(res.status).toBe(401);
  });

  it("menolak password salah", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "mr.admin", password: "salah-sekali" });
    expect(res.status).toBe(401);
  });

  it("mengembalikan profil pengguna yang login", async () => {
    const res = await mrAgent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: "mr.admin", role: "MR" });
  });
});

describe("modul utama (MR)", () => {
  it("dashboard mengembalikan data sesuai role", async () => {
    const res = await mrAgent.get("/api/dashboard");
    expect(res.status).toBe(200);
    expect(res.body).toBeTypeOf("object");
  });

  it("risk register mendukung pagination", async () => {
    const res = await mrAgent.get("/api/risks").query({ page: 1, pageSize: 5 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 5 });
  });

  it("matrix mengembalikan 25 sel", async () => {
    const res = await mrAgent.get("/api/matrix").query({ type: "inherent" });
    expect(res.status).toBe(200);
    expect(res.body.cells).toHaveLength(25);
    expect(res.body.total).toBeTypeOf("number");
  });

  it("antrean approval tersedia", async () => {
    const res = await mrAgent.get("/api/approvals");
    expect(res.status).toBe(200);
    expect(res.body.counts).toMatchObject({
      risks: expect.any(Number),
      mitigations: expect.any(Number),
    });
  });

  it("mitigasi, monitoring, dan notifikasi dapat diakses", async () => {
    const [mit, mon, notif] = await Promise.all([
      mrAgent.get("/api/mitigations"),
      mrAgent.get("/api/monitoring"),
      mrAgent.get("/api/notifications"),
    ]);
    expect(mit.status).toBe(200);
    expect(mon.status).toBe(200);
    expect(mon.body.stats.total).toBeTypeOf("number");
    expect(notif.status).toBe(200);
    expect(Array.isArray(notif.body.data)).toBe(true);
  });

  it("laporan menyertakan ringkasan dan register", async () => {
    const res = await mrAgent.get("/api/reports");
    expect(res.status).toBe(200);
    expect(res.body.summary.total).toBeTypeOf("number");
    expect(Array.isArray(res.body.rows)).toBe(true);
  });

  it("ekspor CSV dapat diunduh", async () => {
    const res = await mrAgent.get("/api/reports/export.csv");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("Kode");
  });

  it("user management hanya untuk MR", async () => {
    const mr = await mrAgent.get("/api/users");
    expect(mr.status).toBe(200);
    expect(mr.body.meta.total).toBeGreaterThan(0);

    const officer = await officerAgent.get("/api/users");
    expect(officer.status).toBe(403);
  });

  it("master data, settings, dan audit tersedia", async () => {
    const [branches, categories, settings, audit] = await Promise.all([
      mrAgent.get("/api/master/branches"),
      mrAgent.get("/api/master/categories"),
      mrAgent.get("/api/settings"),
      mrAgent.get("/api/audit"),
    ]);
    expect(branches.status).toBe(200);
    expect(branches.body.data.length).toBeGreaterThan(0);
    expect(categories.status).toBe(200);
    expect(settings.status).toBe(200);
    expect(audit.status).toBe(200);
  });
});

describe("scope data officer", () => {
  it("officer hanya melihat risiko branch sendiri", async () => {
    const me = await officerAgent.get("/api/auth/me");
    const branchId = me.body.user.branch.id as string;
    const res = await officerAgent.get("/api/risks").query({ pageSize: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const row of res.body.data) {
      expect(row.branch.id).toBe(branchId);
    }
  });
});
