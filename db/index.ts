import {drizzle} from 'drizzle-orm/neon-http';
import {database} from './storage';
import * as schema from './schema';
export function getDb(){return drizzle(database().sql,{schema});}
