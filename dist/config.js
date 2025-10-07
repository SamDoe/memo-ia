import 'dotenv/config';
export const config = {
    port: parseInt(process.env.PORT || '8080', 10),
    host: process.env.HOST || '127.0.0.1',
    env: process.env.NODE_ENV || 'development',
    dbUrl: process.env.DATABASE_URL || './data/memo.db',
    appToken: process.env.APP_BEARER_TOKEN || '',
};
