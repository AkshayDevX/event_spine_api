/* global module, process */

function parseApiInstances(value) {
  if (!value) return "max";
  if (value === "max") return value;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== value) {
    throw new Error("PM2_INSTANCES must be a positive integer or 'max'");
  }

  return parsed;
}

function parseWorkerInstances(value) {
  if (!value) return 1;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== value) {
    throw new Error("PM2_WORKER_INSTANCES must be a positive integer");
  }

  return parsed;
}

const apiInstances = parseApiInstances(process.env.PM2_INSTANCES);
const workerInstances = parseWorkerInstances(process.env.PM2_WORKER_INSTANCES);

module.exports = {
  apps: [
    {
      name: "event-spine-api",
      script: "dist/src/main.js",
      exec_mode: "cluster",
      instances: apiInstances,
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "512M",
      kill_timeout: 10000,
    },
    {
      name: "event-spine-worker",
      script: "dist/src/worker.js",
      exec_mode: "fork",
      instances: workerInstances,
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "512M",
      kill_timeout: 10000,
    },
  ],
};
