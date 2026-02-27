/**
 * Core launcher - 启动 langchain-serve 与 pty-host
 *
 * 不做子进程、不递归：单进程内顺序 require 两个 worker，避免 process.execPath
 * 在 pkg 下指向 target/debug/core.exe（不存在）导致 spawn ENOENT。
 */
const path = require('path');

const WORKERS = ['langchain-serve', 'pty-host'];

console.log('[core] Master starting...');

WORKERS.forEach((name) => {
  const scriptPath = path.join(__dirname, name + '.js');
  console.log('[core] load ' + name + ' ...');
  require(scriptPath);
});
