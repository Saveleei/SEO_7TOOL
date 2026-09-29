module.exports = {
  apps: [
    {
      name: "7tool-storefront-vinext",
      cwd: __dirname,
      script: "scripts/start-production.sh",
      interpreter: "/bin/sh",
      max_memory_restart: "1280M",
      kill_timeout: 10000,
      restart_delay: 3000,
      max_restarts: 5,
      min_uptime: "30s",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
