import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  env: process.env.NODE_ENV || 'development',
  dbUrl: process.env.DATABASE_URL || './data/memo.db',
  appToken: process.env.APP_BEARER_TOKEN || '',
};