import { createLogger, format, transports, Logger as logger } from "winston";

// Configure Winston logger
const { combine, timestamp, printf } = format;
const myFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

export const Logger: logger = createLogger({
  level: "info",
  format: combine(timestamp(), myFormat),
  transports: [
    new transports.Console({ level: "info" }),
    // Add other transports like file, database, etc. as needed
  ],
});