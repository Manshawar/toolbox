/**
 * Core launcher - 由 Tauri 用内置 Node 启动，传入 command + 环境变量
 *
 * - 第一次: args = ['langchain-serve'], env = { API_PORT, PTY_PORT, ... }
 * - 第二次: args = ['pty-host'],       env = { API_PORT, PTY_PORT, ... }
 */
const command = process.argv[2];

switch (command) {
  case 'langchain-serve':
    require('./langchain-serve.js');
    break;
  case 'pty-host':
    require('./pty-host.js');
    break;
  default:
    console.error(`[core] unknown command: ${command}`);
    process.exit(1);
}
