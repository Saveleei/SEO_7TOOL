/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");

module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || "7tool",
      cwd: __dirname,
      script: path.join(__dirname, "node_modules", "next", "dist", "bin", "next"),
      args: `start -p ${process.env.PORT || 3000}`,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "900M",
      kill_timeout: 10000,
      listen_timeout: 15000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
