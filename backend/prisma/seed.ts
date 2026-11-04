import { PrismaClient, RoleName, RiskLevel, RiskStatus, MitigationStatus, ApprovalAction } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "JxbMr2024!";

// Deterministic pseudo-random (seeded LCG) agar seed selalu menghasilkan data yang sama.
let lcgState = 42;
function rand() {
  lcgState = (lcgState * 1664525 + 1013904223) % 4294967296;
  return lcgState / 4294967296;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function scoreLevel(p: number, i: number): { score: number; level: RiskLevel } {
  const score = p * i;
  let level: RiskLevel = "LOW";
  if (score >= 16) level = "VERY_HIGH";
  else if (score >= 11) level = "HIGH";
  else if (score >= 6) level = "MEDIUM";
  return { score, level };
}
function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

const BRANCHES = [
  { code: "HQ", name: "Head Office Jakarta", description: "Kantor pusat JXB Jakarta" },
  { code: "BRC01", name: "Cabang Jakarta Utara", description: "Wilayah operasional Jakarta Utara" },
  { code: "BRC02", name: "Cabang Jakarta Barat", description: "Wilayah operasional Jakarta Barat" },
  { code: "BRC03", name: "Cabang Jakarta Selatan", description: "Wilayah operasional Jakarta Selatan" },
  { code: "BRC04", name: "Cabang Jakarta Timur", description: "Wilayah operasional Jakarta Timur" },
  { code: "BRC05", name: "Cabang Jakarta Pusat", description: "Wilayah operasional Jakarta Pusat" },
];

const CATEGORIES = [
  { code: "STR", name: "Strategis", description: "Risiko terkait strategi dan tujuan organisasi" },
  { code: "OPS", name: "Operasional", description: "Risiko proses dan operasional harian" },
  { code: "FIN", name: "Keuangan", description: "Risiko keuangan dan penganggaran" },
  { code: "CMP", name: "Kepatuhan", description: "Risiko regulasi dan hukum" },
  { code: "ITG", name: "Teknologi & Keamanan Informasi", description: "Risiko sistem informasi dan keamanan data" },
  { code: "HRD", name: "SDM", description: "Risiko sumber daya manusia" },
  { code: "PRO", name: "Proyek", description: "Risiko pelaksanaan proyek" },
  { code: "REP", name: "Reputasi", description: "Risiko reputasi organisasi" },
];

const RISK_TEMPLATES = [
  { title: "Fraud di prosedur pengadaan", desc: "Sepotong pegawai bisa melakukan kecurangan pengadaan lewat pemilihan vendor tidak jelas.", cat: "CMP", cause: "Kontrol pengadaan lemah; dokumentasi tidak lengkap", impact: "Kerugian finansial; sanksi hukum" },
  { title: "Kebocoran data pribadi nasabah", desc: "Data personal pengguna sistem dapat terbocoro ke pihak luar.", cat: "ITG", cause: "Enkripsi tidak lengkap; akses tidak diawasi", impact: "Kerugian reputasi; denda regulator" },
  { title: "Serangan ransomware pada server", desc: "Malware dapat mengunci server dan menuntut tebusan.", cat: "ITG", cause: "Patch lambat; user awareness rendah", impact: "Layanan terhenti; kebocoran data" },
  { title: "Keterlambatan pelaporan keuangan", desc: "Laporan keuangan tidak terbit tepat waktu.", cat: "FIN", cause: "Proses rekonsiliasi manual", impact: "Pelanggaran kepatuhan" },
  { title: "Kegagalan rekrutmen posisi kunci", desc: "Posisi penting kosong lama sehingga kapasitas menurun.", cat: "HRD", cause: "Biru employer branding lemah", impact: "Target kerja terganggu" },
  { title: "Proyek melebihi anggaran (budget overrun)", desc: "Biaya proyek melampaui pagu yang disetujui.", cat: "PRO", cause: "Perencanaan kurang matang; perubahan scope", impact: "Defisit anggaran; benefit delayed" },
  { title: "Culik atau keretakan layanan customer", desc: "Keluhan pelanggan menular di media sosial.", cat: "REP", cause: "SLA layanan tidak tercapai", impact: "Reputasi menurun; churn" },
  { title: "Penipuan klaim reimbursement", desc: "Klaim fiktif diajukan oleh pegawai.", cat: "OPS", cause: "Verifikasi tuntutan tidak ketat", impact: "Kerugian operasional" },
  { title: "Vendor utama gagal kirim", desc: "Vendor tunggal tidak dapat memasok barang/jasa.", cat: "OPS", cause: "Vendor tunggal; tidak ada backup", impact: "Rantai suplai terputus" },
  { title: "Perubahan regulasi sektornya", desc: "Kebijakan baru mengharuskan penyesuaian proses.", cat: "CMP", cause: "Tidak memantau regulasi aktif", impact: "Penghentian kegiatan; denda" },
  { title: "Kosongnya sekuritas backup data", desc: "Backup tidak dapat direstore saat dibutuhkan.", cat: "ITG", cause: "Test restore jarang dilakukan", impact: "Data ilang permanen" },
  { title: "Kasus gugatan kepegawaian", desc: "Pegawai menggugat perusahaan terkait kebijakan SDM.", cat: "HRD", cause: "Kebijakan tidak jelas; komunikasi lemah", impact: "Biaya hukum; reputasi" },
  { title: "Kegagalan sistem saat jam sibuk", desc: "Aplikasi crash saat pemakaian tertinggi.", cat: "ITG", cause: "Kapasitas infrauktur di bawah beban", impact: "Servis terganggu" },
  { title: "Ketidakhadiran key person", desc: "Personel kunci Lebih makan cuti panjang lama/tidak kembali.", cat: "HRD", cause: "Tidak ada successor plan", impact: "Kontinuitas proyek terganggu" },
  { title: "Pencatatan aset tidak cocok fisik", desc: "Serasi aset antara sistem dan fisik tidak akurat.", cat: "FIN", cause: "Stock opname jarang", impact: "Laporan aset keliru" },
  { title: "Kegagalan integrasi sistem baru", desc: "Aplikasi baru tidak kompatible dengan sistem legacy.", cat: "PRO", cause: "Mapping data tidak lengkap", impact: "Data salah; proyek molor" },
];

const RISK_STATUS_DIST: RiskStatus[] = [
  ...Array(6).fill("DRAFT"),
  ...Array(5).fill("SUBMITTED"),
  ...Array(3).fill("RETURNED"),
  ...Array(4).fill("PENDING_VALIDATION"),
  ...Array(2).fill("REJECTED"),
  ...Array(13).fill("ACTIVE"),
  ...Array(3).fill("PENDING_VERIFICATION"),
  ...Array(3).fill("CLOSED"),
] as RiskStatus[];

const PERMISSIONS: { code: string; description: string }[] = [
  { code: "dashboard:view", description: "Melihat dashboard sesuai scope" },
  { code: "risk:view", description: "Melihat risk register per scope" },
  { code: "risk:create", description: "Membuat risiko baru" },
  { code: "risk:update", description: "Mengubah risiko" },
  { code: "risk:delete", description: "Menghapus risiko (draft)" },
  { code: "risk:submit", description: "Mengajukan risiko untuk review" },
  { code: "risk:review", description: "Review kelengkapan risiko (officer)" },
  { code: "risk:validate", description: "Validasi / approval risiko (MR)" },
  { code: "assessment:manage", description: "Mengelola inherent & residual assessment" },
  { code: "assessment:review", description: "Review residual assessment (MR)" },
  { code: "mitigation:manage", description: "Mengelola mitigation plan & progres" },
  { code: "mitigation:verify", description: "Verifikasi pelaksanaan mitigasi (officer)" },
  { code: "monitoring:view", description: "Melihat monitoring risiko" },
  { code: "matrix:view", description: "Melihat risk matrix" },
  { code: "reporting:view", description: "Melihat laporan" },
  { code: "reporting:export", description: "Export laporan Excel/CSV/PDF" },
  { code: "audit:view", description: "Melihat audit trail" },
  { code: "user:manage", description: "Kelola akun user (MR admin)" },
  { code: "branch:manage", description: "Kelola cabang / branch (MR)" },
  { code: "category:manage", description: "Kelola kategori risiko (MR)" },
  { code: "settings:manage", description: "Kelola setting sistem (MR)" },
];

const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  MR: [
    "dashboard:view", "risk:view", "risk:validate", "assessment:review", "monitoring:view",
    "matrix:view", "reporting:view", "reporting:export", "audit:view",
    "user:manage", "branch:manage", "category:manage", "settings:manage",
  ],
  RISK_OFFICER: [
    "dashboard:view", "risk:view", "risk:review", "assessment:manage",
    "mitigation:verify", "monitoring:view", "matrix:view", "reporting:view", "reporting:export",
  ],
  RISK_OWNER: [
    "dashboard:view", "risk:view", "risk:create", "risk:update", "risk:delete", "risk:submit",
    "assessment:manage", "mitigation:manage", "monitoring:view", "matrix:view", "reporting:view",
  ],
};

async function seedRoles() {
  const roles: Partial<Record<RoleName, string>> = {
    MR: "Manajemen Risiko - admin sistem pengelolaan risiko",
    RISK_OFFICER: "Risk Officer - review & verifikasi untuk satu cabang",
    RISK_OWNER: "Risk Owner - pengelola risiko untuk satu cabang",
  };
  for (const name of Object.keys(roles) as RoleName[]) {
    await prisma.role.upsert({ where: { name }, update: { description: roles[name] }, create: { name, description: roles[name] } });
  }
}

async function seedPermissions() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { code: p.code }, update: { description: p.description }, create: p });
  }
  const allPerms = await prisma.permission.findMany();
  const allRoles = await prisma.role.findMany();
  for (const role of allRoles) {
    const allowed = new Set(ROLE_PERMISSIONS[role.name]);
    for (const p of allPerms) {
      if (!allowed.has(p.code)) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
        update: {},
        create: { roleId: role.id, permissionId: p.id },
      });
    }
  }
}

async function seedBranches() {
  for (const b of BRANCHES) {
    await prisma.branch.upsert({
      where: { code: b.code },
      update: { name: b.name, description: b.description },
      create: b,
    });
  }
}

async function seedCategories() {
  for (const c of CATEGORIES) {
    await prisma.riskCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description },
      create: c,
    });
  }
}

async function seedUsers() {
  const roleMap = await prisma.role.findMany();
  const branchMap = await prisma.branch.findMany();
  const roleByName = new Map(roleMap.map((r) => [r.name, r.id]));
  const branchByCode = new Map(branchMap.map((b) => [b.code, b.id]));

  const users: {
    username: string; email: string; fullName: string; role: RoleName; branchCode?: string;
  }[] = [
    { username: "mr.admin", email: "mr.admin@jxb.co.id", fullName: "Kepala Manajemen Risiko", role: "MR" },
    { username: "mr.analyst", email: "mr.analyst@jxb.co.id", fullName: "Analis Manajemen Risiko", role: "MR" },
  ];
  for (const b of BRANCHES) {
    users.push({ username: "officer." + b.code.toLowerCase(), email: "officer." + b.code.toLowerCase() + "@jxb.co.id", fullName: "Risk Officer " + b.name, role: "RISK_OFFICER", branchCode: b.code });
    users.push({ username: "owner." + b.code.toLowerCase(), email: "owner." + b.code.toLowerCase() + "@jxb.co.id", fullName: "Risk Owner " + b.name, role: "RISK_OWNER", branchCode: b.code });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const created = new Map<string, string>();
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: { fullName: u.fullName, roleId: roleByName.get(u.role)!, branchId: u.branchCode ? (branchByCode.get(u.branchCode) ?? null) : null },
      create: {
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        passwordHash,
        roleId: roleByName.get(u.role)!,
        branchId: u.branchCode ? (branchByCode.get(u.branchCode) ?? null) : null,
      },
    });
    created.set(u.username, user.id);
  }

  return { branchByCode, categoryByCode: (await prisma.riskCategory.findMany()).reduce<Map<string, string>>((m, c) => m.set(c.code, c.id), new Map()), users: created };
}

async function seedDemoRisks(ctx: {
  branchByCode: Map<string, string>;
  categoryByCode: Map<string, string>;
  users: Map<string, string>;
}) {
  const branches = BRANCHES.map((b) => b.code);
  const now = new Date();
  let seq = 0;

  for (const branchCode of branches) {
    const branchId = ctx.branchByCode.get(branchCode)!;
    const ownerName = "owner." + branchCode.toLowerCase();
    const officerName = "officer." + branchCode.toLowerCase();
    const ownerId = ctx.users.get(ownerName)!;
    const officerId = ctx.users.get(officerName)!;
    const mrAdminId = ctx.users.get("mr.admin")!;

    const cnt = branchCode === "HQ" ? 10 : 6;
    for (let n = 0; n < cnt; n++) {
      seq++;
      const tpl = RISK_TEMPLATES[seq % RISK_TEMPLATES.length];
      const code = `${branchCode}-R${String(n + 1).padStart(2, "0")}`;
      const status = RISK_STATUS_DIST[(seq - 1) % RISK_STATUS_DIST.length];
      const category = CATEGORIES.find((c) => c.code === tpl.cat)!;
      const categoryId = ctx.categoryByCode.get(tpl.cat)!;

      const p = randInt(1, 5);
      const i = randInt(1, 5);
      const inh = scoreLevel(p, i);
      const useResidual = !["DRAFT", "SUBMITTED", "RETURNED", "REJECTED"].includes(status);
      const rp = Math.max(1, useResidual ? Math.max(1, randInt(1, Math.max(1, p))) : p);
      const ri = Math.max(1, useResidual ? Math.max(1, randInt(1, Math.max(1, i))) : i);
      const res = scoreLevel(rp, ri);

      const createdAt = addDays(now, -randInt(30, 180));
      const existing = await prisma.risk.findUnique({ where: { code } });
      if (existing) continue;

      const risk = await prisma.risk.create({
        data: {
          code,
          branchId,
          categoryId,
          ownerId,
          createdById: ownerId,
          title: tpl.title,
          description: tpl.desc,
          causes: tpl.cause,
          impacts: tpl.impact,
          status,
          inherentProbability: p,
          inherentImpact: i,
          inherentScore: inh.score,
          inherentLevel: inh.level,
          residualProbability: useResidual ? rp : null,
          residualImpact: useResidual ? ri : null,
          residualScore: useResidual ? res.score : null,
          residualLevel: useResidual ? res.level : null,
          createdAt,
          updatedAt: createdAt,
        },
      });

      // Assessments (snapshot)
      await prisma.riskAssessment.create({
        data: { riskId: risk.id, type: "INHERENT", probability: p, impact: i, score: inh.score, level: inh.level, justification: "Penilaian awal saat identifikasi risiko", assessedById: ownerId, createdAt },
      });
      if (useResidual) {
        await prisma.riskAssessment.create({
          data: { riskId: risk.id, type: "RESIDUAL", probability: rp, impact: ri, score: res.score, level: res.level, justification: "Penilaian residual setelah mitigasi direncanakan", assessedById: ownerId, createdAt: addDays(createdAt, 5) },
        });
      }

      // Assessment history
      await prisma.assessmentHistory.create({
        data: { riskId: risk.id, type: "INHERENT", oldProbability: null, oldImpact: null, newProbability: p, newImpact: i, reason: "Penetapan awal inherent assessment", changedById: ownerId, createdAt },
      });

      // Workflow approvals sesuai status
      const wfs: { action: ApprovalAction; from: RiskStatus | null; to: RiskStatus | null; actorId: string; note: string | null; at: Date }[] = [];
      let cur = createdAt;
      if (status !== "DRAFT") {
        wfs.push({ action: "SUBMIT", from: "DRAFT", to: "SUBMITTED", actorId: ownerId, note: null, at: (cur = addDays(createdAt, 1)) });
      }
      if (status === "RETURNED") {
        wfs.push({ action: "RETURN_FOR_REVISION", from: "SUBMITTED", to: "RETURNED", actorId: officerId, note: "Kelengkapan risiko belum lengkap, mohon revisi assessment.", at: (cur = addDays(cur, 2)) });
      } else if (["PENDING_VALIDATION", "ACTIVE", "PENDING_VERIFICATION", "CLOSED", "REJECTED"].includes(status) || status === "PENDING_VALIDATION") {
        wfs.push({ action: "REVIEW_APPROVE", from: "SUBMITTED", to: "PENDING_VALIDATION", actorId: officerId, note: "Kelengkapan risiko sudah sesuai, lanjut ke validasi MR.", at: (cur = addDays(cur, 2)) });
      }
      if (status === "REJECTED") {
        wfs.push({ action: "VALIDATE_REJECT", from: "PENDING_VALIDATION", to: "REJECTED", actorId: mrAdminId, note: "Penilaian dampak belum realistis, silakan ajukan ulang.", at: (cur = addDays(cur, 2)) });
      } else if (["ACTIVE", "PENDING_VERIFICATION", "CLOSED"].includes(status)) {
        wfs.push({ action: "VALIDATE", from: "PENDING_VALIDATION", to: "ACTIVE", actorId: mrAdminId, note: "Risiko tervalidasi, mitigasi dapat berjalan.", at: (cur = addDays(cur, 3)) });
      }
      if (status === "PENDING_VERIFICATION") {
        wfs.push({ action: "UPDATE_PROGRESS", from: "ACTIVE", to: "PENDING_VERIFICATION", actorId: ownerId, note: "Progres mitigasi terakhir diajukan untuk verifikasi.", at: (cur = addDays(cur, 10)) });
      }
      if (status === "CLOSED") {
        wfs.push({ action: "VERIFY", from: "ACTIVE", to: "PENDING_VERIFICATION", actorId: officerId, note: null, at: addDays(cur, 5) });
        wfs.push({ action: "RESIDUAL_APPROVE", from: "PENDING_VERIFICATION", to: "CLOSED", actorId: mrAdminId, note: "Residual assessment diterima, risiko ditutup.", at: addDays(cur, 8) });
      }
      for (const w of wfs) {
        await prisma.workflowApproval.create({ data: { riskId: risk.id, action: w.action, fromStatus: w.from, toStatus: w.to, note: w.note, actorId: w.actorId, createdAt: w.at } });
      }

      // Review commentary columns for returned/rejected
      if (["RETURNED", "REJECTED"].includes(status)) {
        await prisma.reviewComment.create({
          data: {
            riskId: risk.id, authorId: status === "RETURNED" ? officerId : mrAdminId,
            authorRole: status === "RETURNED" ? "RISK_OFFICER" : "MR",
            comment: status === "RETURNED" ? "Causes dan impacts belum jelas, mohon diperjelas sebelum diajukan ulang." : "Impact rating terlalu rendah dibanding domain sejenis.",
            createdAt: addDays(createdAt, 3),
          },
        });
      }

      // Mitigation plan for ACTIVE / PENDING_VERIFICATION / CLOSED
      if (["ACTIVE", "PENDING_VERIFICATION", "CLOSED"].includes(status)) {
        const start = addDays(createdAt, 6);
        const due = addDays(start, randInt(30, 90));
        let progress = randInt(10, 90);
        let mStatus: MitigationStatus = "IN_PROGRESS";
        if (status === "CLOSED") { progress = 100; mStatus = "COMPLETED"; }
        if (status === "PENDING_VERIFICATION") { progress = randInt(60, 100); mStatus = "PENDING_VERIFICATION"; }
        const plan = await prisma.mitigationPlan.create({
          data: {
            riskId: risk.id,
            description: "Program mitigasi untuk " + tpl.title.toLowerCase(),
            actionPlan: "Tahap 1: identifikasi kontrol. Tahap 2: implementasi kontrol. Tahap 3: monitoring berkala.",
            responsibleId: ownerId,
            startDate: start,
            dueDate: due,
            budget: randInt(10, 200) * 1000000,
            progress,
            status: mStatus,
            createdAt: start,
            updatedAt: addDays(start, randInt(5, 25)),
          },
        });
        const updCount = status === "CLOSED" ? 3 : 2;
        for (let k = 0; k < updCount; k++) {
          const up = await prisma.mitigationUpdate.create({
            data: {
              planId: plan.id,
              progress: Math.min(100, progress - (updCount - 1 - k) * 20),
              note: ["Progres awal pelaksanaan", "Progres menengah, hampir selesai", "Seluruh tahapan selesai"][k] ?? null,
              submittedById: ownerId,
              createdAt: addDays(start, k * 7 + 2),
            },
          });
          if (k === 0 || status === "CLOSED") {
            await prisma.mitigationEvidence.create({
              data: {
                planId: plan.id, updateId: up.id,
                fileName: `bukti-laporan-${code.toLowerCase()}-w${k + 1}.pdf`,
                filePath: "uploads/evidence/demo-" + code.toLowerCase() + "-" + k + ".pdf",
                mimeType: "application/pdf", size: 1024 * (120 + k),
                uploadedById: ownerId, createdAt: addDays(start, k * 7 + 2),
              },
            });
          }
        }
      }
    }
  }
}

async function seedSettings() {
  const settings = [
    { key: "risk.level.thresholds", value: JSON.stringify({ low: [1, 5], medium: [6, 10], high: [11, 15], very_high: [16, 25] }), description: "Ambang batas skor per level risiko" },
    { key: "submission.review.sla_days", value: "5", description: "SLA review (hari) oleh Risk Officer" },
    { key: "management.validation.sla_days", value: "5", description: "SLA validasi (hari) oleh Manajemen Risiko" },
    { key: "upload.max_size_mb", value: "5", description: "Ukuran maksimum file upload (MB)" },
    { key: "monitoring.overdue_grace_days", value: "3", description: "Toleransi keterlambatan mitigasi (hari)" },
  ];
  const adminId = (await prisma.user.findUnique({ where: { username: "mr.admin" } }))?.id ?? null;
  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: { ...s, updatedById: adminId },
    });
  }
}

async function main() {
  console.log("[seed] Memulai seed JXB-MR (idempotent, tidak menghapus data)...");
  await seedRoles();
  await seedPermissions();
  await seedBranches();
  await seedCategories();
  const ctx = await seedUsers();
  await seedDemoRisks(ctx);
  await seedSettings();
  const counts = {
    users: await prisma.user.count(),
    branches: await prisma.branch.count(),
    categories: await prisma.riskCategory.count(),
    risks: await prisma.risk.count(),
    mitigations: await prisma.mitigationPlan.count(),
    approvals: await prisma.workflowApproval.count(),
  };
  console.log("[seed] Selesai:", JSON.stringify(counts));
  console.log(`[seed] Password semua akun demo: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("[seed] GAGAL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
