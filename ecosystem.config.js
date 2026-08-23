module.exports = {
  apps: [
    {
      name: "classsuperman",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      // 單一實例：SQLite 寫入與 latest.json 輪替不可多行程併發
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_memory_restart: "512M",
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
