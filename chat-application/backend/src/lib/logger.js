import pino from 'pino';
import { ENV } from './env.js';

const isDev = ENV.NODE_ENV === 'development';

export const logger = pino({
  level: ENV.LOG_LEVEL || (ENV.NODE_ENV === 'test' ? 'silent' : 'info'),
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

export default logger;
