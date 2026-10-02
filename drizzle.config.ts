import {defineConfig} from 'drizzle-kit';
import {existsSync} from 'node:fs';
if(existsSync('.env'))process.loadEnvFile('.env');
export default defineConfig({out:'./drizzle',schema:'./db/schema.ts',dialect:'postgresql',...(process.env.DATABASE_URL?{dbCredentials:{url:process.env.DATABASE_URL}}:{})});
