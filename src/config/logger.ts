const isDev = process.env.NODE_ENV !== "production";

export const loggerOptions = {
  level: isDev ? "debug" : "info",
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
