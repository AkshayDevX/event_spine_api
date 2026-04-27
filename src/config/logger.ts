import pino from "pino";
import { env } from "./env";

const isDev = env.NODE_ENV !== "production";
const logLevel = env.LOG_LEVEL;

export const loggerOptions = {
  level: logLevel,
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  }),
};

export const logger = pino(loggerOptions);
