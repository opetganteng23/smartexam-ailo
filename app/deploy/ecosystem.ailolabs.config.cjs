// PM2 untuk server ailolabs (Biznet Gio): jalankan dari folder app/ setelah `npm ci && npm run build`.
//   pm2 start deploy/ecosystem.ailolabs.config.cjs --env production && pm2 save
// Caddy (kontainer Docker) meneruskan ke 172.19.0.1:4100, jadi aplikasi mendengarkan di semua antarmuka seperti aplikasi lain di server ini.
// SATU instance (fork) disengaja: rate limit dan penjadwal berjalan di dalam proses.
module.exports = {
  apps: [
    {
      name: "smartexam",
      cwd: __dirname + "/..",
      script: "deploy/start-smartexam.sh",
      interpreter: "bash",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "700M",
      kill_timeout: 10000,
      time: true,
      env_production: { NODE_ENV: "production", PORT: "4100", ENABLE_INPROCESS_CRON: "true", UV_THREADPOOL_SIZE: "4", NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
};
