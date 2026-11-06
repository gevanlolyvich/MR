# JXB-MR — Enterprise Risk Management System

Aplikasi manajemen risiko korporasi JXB: registrasi risiko, penilaian inherent & residual, matriks risiko, rencana mitigasi, alur persetujuan berjenjang, monitoring, pelaporan, audit trail, serta administrasi pengguna dan master data.

Monorepo berisi **frontend** (React + Vite + TypeScript + Tailwind) dan **backend** (Express + TypeScript + Prisma + MySQL/MariaDB).

## Fitur Utama

- **Risk Register** — CRUD risiko per branch, kategori, pemilik, dan status workflow.
- **Risk Assessment** — penilaian probability × impact untuk inherent dan residual, riwayat perubahan.
- **Risk Matrix** — matriks 5×5 interaktif (inherent/residual) dengan drill-down.
- **Mitigation Plan** — rencana, update progres, bukti (upload), verifikasi.
- **Approval Workflow** — submit → review → validasi manajemen → aktif → verifikasi residual → closed.
- **Monitoring** — daftar risiko aktif, progres mitigasi, dan indikator overdue.
- **Reporting** — ringkasan eksekutif, distribusi level/status/kategori/branch, ekspor CSV.
- **Audit Trail** — log aktivitas lengkap dengan filter aksi/entitas/pelaku/tanggal.
- **Administrasi** — user management (MR), branch, kategori risiko, dan system settings.
- **Notifikasi** — bell notifikasi in-app dengan penanda sudah dibaca.
- **RBAC** — tiga role: Management Representative (MR), Risk Officer, Risk Owner.

## Teknologi

| Layer    | Stack                                                                 |
| -------- | --------------------------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, React Hook Form + Zod, Recharts |
| Backend  | Node.js, Express, TypeScript, Prisma ORM, Zod, JWT (httpOnly cookie), Multer |
| Database | MySQL 8 / MariaDB 10.4+                                               |
| Testing  | Vitest + Supertest                                                    |

## Prasyarat

- Node.js 18+ dan npm 9+
- MySQL/MariaDB berjalan di `127.0.0.1:3306`
- Akun database dengan hak membuat database (default: `root` tanpa password)

## Instalasi

```bash
npm install
```

Salin konfigurasi backend lalu sesuaikan bila perlu:

```bash
copy backend\.env.example backend\.env
```

Isi penting `backend/.env`:

```env
DATABASE_URL="mysql://root:@127.0.0.1:3306/erm_system"
PORT=4000
CORS_ORIGIN="http://localhost:5173"
JWT_SECRET="ganti-dengan-secret-panjang-acak-minimal-32-karakter"
JWT_EXPIRES_IN="12h"
NODE_ENV="development"
```

Siapkan database, migrasi, dan data demo:

```bash
# buat database bila belum ada
mysql -uroot -e "CREATE DATABASE IF NOT EXISTS erm_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

npm run db:deploy
npm run db:seed
```

## Menjalankan Aplikasi

Mode pengembangan (backend + frontend sekaligus):

```bash
npm run dev
```

Atau terpisah:

```bash
npm run dev -w backend     # http://localhost:4000
npm run dev -w frontend    # http://localhost:5173
```

Build produksi:

```bash
npm run build
npm run start -w backend   # menyajikan API dari dist/
```

Frontend hasil build dapat dilayani oleh web server statis; pastikan proxy `/api` dan `/uploads` diarahkan ke backend.

## Akun Demo

Semua akun memakai password yang sama: **`JxbMr2024!`**

| Username                              | Role         | Branch        |
| ------------------------------------- | ------------ | ------------- |
| `mr.admin`, `mr.analyst`              | MR           | — (semua)     |
| `officer.hq`, `officer.brc01`…`brc05` | Risk Officer | HQ / BRC01–05 |
| `owner.hq`, `owner.brc01`…`brc05`     | Risk Owner   | HQ / BRC01–05 |

MR memiliki akses penuh (bypass permission). Officer dan Owner dibatasi pada branch masing-masing.

## Alur Workflow Risiko

```
DRAFT → SUBMITTED → PENDING_VALIDATION → ACTIVE → PENDING_VERIFICATION → CLOSED
                 ↘ RETURNED            ↘ REJECTED
```

- **Risk Owner** menyusun dan mengajukan risiko.
- **Risk Officer** melakukan review awal.
- **MR** memvalidasi keputusan manajemen.
- Risiko aktif dapat diajukan residual dan diverifikasi untuk ditutup.

## Skor Risiko

`score = probability × impact` (masing-masing 1–5).

| Level     | Rentang |
| --------- | ------- |
| LOW       | 1–5     |
| MEDIUM    | 6–10    |
| HIGH      | 11–15   |
| VERY_HIGH | 16–25   |

## Scripts

| Perintah             | Keterangan                                   |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | Jalankan backend & frontend (concurrently)   |
| `npm run build`      | Build backend lalu frontend                  |
| `npm run test`       | Jalankan seluruh test backend (Vitest)       |
| `npm run db:generate`| Generate Prisma Client                       |
| `npm run db:migrate` | Buat/terapkan migrasi (development)          |
| `npm run db:deploy`  | Terapkan migrasi (deploy)                    |
| `npm run db:seed`    | Isi data demo (idempotent)                   |
| `npm run db:status`  | Cek status migrasi                           |
| `npm run db:check`   | Verifikasi koneksi & jumlah data             |

## Struktur Proyek

```
jxb-mr/
├─ backend/
│  ├─ prisma/            # schema, migrasi, seed
│  ├─ src/
│  │  ├─ modules/        # auth, risks, approvals, mitigations, monitoring,
│  │  │                  # notifications, users, master, audit, settings, reports
│  │  ├─ middleware/     # auth, permission, error handler
│  │  ├─ lib/            # prisma, error, audit
│  │  ├─ app.ts
│  │  └─ server.ts
│  ├─ test/              # unit + integration test
│  └─ uploads/           # bukti mitigasi (runtime, tidak di-commit)
└─ frontend/
   ├─ public/branding/   # logo & favicon JXB
   └─ src/
      ├─ app/            # router
      ├─ components/     # layout & UI kit
      ├─ contexts/       # auth, toast
      ├─ features/       # dashboard, risks, approvals, mitigations, monitoring,
      │                  # reports, users, branches, master-data, audit, settings
      └─ lib/            # axios client, util
```

## Ringkasan API

Semua endpoint di bawah `/api` dan memerlukan sesi login (kecuali login & health).

| Area          | Endpoint                                                                 |
| ------------- | ------------------------------------------------------------------------ |
| Auth          | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password` |
| Dashboard     | `GET /dashboard`                                                         |
| Risiko        | `GET/POST /risks`, `GET/PUT/DELETE /risks/:id`, submit/review/validate/residual/verify, komentar |
| Matriks       | `GET /matrix`                                                            |
| Approval      | `GET /approvals`, `POST /approvals/:id/review\|validate\|submit-residual\|verify` |
| Mitigasi      | `GET/POST /mitigations`, update progres, bukti, verifikasi                |
| Monitoring    | `GET /monitoring`                                                        |
| Notifikasi    | `GET /notifications`, tandai dibaca (satu/semua)                          |
| Laporan       | `GET /reports`, `GET /reports/export.csv`                                 |
| Pengguna      | `GET/POST /users`, `PUT /users/:id`, reset password, status (MR)          |
| Master data   | `/master/branches`, `/master/categories`, `/owners`                      |
| Audit         | `GET /audit`, `GET /audit/actions`                                       |
| Settings      | `GET /settings`, `PUT /settings`                                         |

## Testing

Test menggunakan Vitest + Supertest. Test integrasi membutuhkan database yang sudah dimigrasi dan di-seed.

```bash
npm test
```

- `test/risk-scores.test.ts` — unit test perhitungan skor & level risiko.
- `test/api.test.ts` — integrasi API: autentikasi, RBAC, dashboard, risiko, matriks, approval, mitigasi, monitoring, laporan/CSV, master data, settings, audit, dan scope branch.

## Catatan

- Upload bukti mitigasi disimpan di `backend/uploads/evidence` (maks. 5 MB; PDF/gambar/dokumen/spreadsheet).
- Sesi menggunakan cookie httpOnly `jxbmr_token` (12 jam). Ganti `JWT_SECRET` di produksi.
- Endpoint login dibatasi 10 percobaan/menit per IP.
- Menu dan aksi mengikuti permission role; MR selalu memiliki akses penuh.
