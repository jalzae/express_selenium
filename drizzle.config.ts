import type { Config } from 'drizzle-kit';

export default {
  schema: './api/db/schema.ts',
  out: './api/db/migrations',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'nuxt_db',
  },
} satisfies Config;
