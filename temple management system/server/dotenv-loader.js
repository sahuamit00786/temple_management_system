import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
// Load .env from server/ directory, works regardless of cwd
config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') });
