import app from "./app";

const port = Number(process.env.PORT || 4000);

const server = app.listen(port, () => {
  console.log(`JXB-MR backend berjalan di http://localhost:${port}`);
});

server.on("error", (err) => {
  console.error("[server] Gagal menjalankan server:", err);
  process.exit(1);
});
