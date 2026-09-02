import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'autosar_db';

export async function initDatabase() {
  console.log(`[DB INIT] Connecting to MySQL at ${dbHost}:${dbPort} as '${dbUser}'...`);

  let connection;
  try {
    // 1. Connect without selecting database
    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      multipleStatements: true
    });

    // 2. Create database if it doesn't exist
    console.log(`[DB INIT] Creating database '${dbName}' if not exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${dbName}\`;`);

    // 3. Read and execute schema.sql. The file deliberately contains only table
    // definitions so DB_NAME is honoured instead of being hard-coded.
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    await connection.query(schemaSql);

    console.log(`[DB INIT] ✅ Successfully initialized MySQL database '${dbName}' and all tables!`);
    return { success: true };
  } catch (error) {
    console.error(`[DB INIT] ❌ Error initializing database:`, error.message);
    return { success: false, error: error.message };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run directly if called as a script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initDatabase()
    .then(result => {
      if (result.success) {
        console.log('[DB INIT] Database initialization complete.');
        process.exit(0);
      } else {
        console.error('[DB INIT] Database initialization failed:', result.error);
        process.exit(1);
      }
    });
}
