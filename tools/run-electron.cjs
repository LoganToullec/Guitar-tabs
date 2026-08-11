/**
 * Launches Electron with a clean environment.
 *
 * VS Code exports ELECTRON_RUN_AS_NODE=1 to its integrated terminals; inherited by
 * our own Electron it would boot as plain Node and `require('electron')` would then
 * resolve to the launcher shim instead of the real API. Stripping it here keeps
 * `npm start` working from any terminal.
 *
 * Usage: node tools/run-electron.cjs <entry> [args...]
 */
const { spawn } = require('node:child_process');
const electronPath = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, process.argv.slice(2), { stdio: 'inherit', env });
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
