import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const nextEntry = join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');

const proc = spawn(process.execPath, [nextEntry, 'dev', '--port', '3000'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: false,
});

proc.on('exit', (code) => process.exit(code ?? 0));
