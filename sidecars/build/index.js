/**
 * Core launcher - 由 Rust 分别启动两次，每次传入 command + 环境变量
 *
 * - 第一次: args = ['langchain-serve'], env = { API_PORT, PTY_PORT }
 * - 第二次: args = ['pty-host'],       env = { API_PORT, PTY_PORT }
 * 各 worker 只使用自己对应的端口（langchain-serve 用 API_PORT，pty-host 用 PTY_PORT）。
 *
 * 打包后打印 pkg 目录结构：设置环境变量 DEBUG_PKG=1 后启动，例如：
 *   DEBUG_PKG=1 ./src-tauri/binaries/core-aarch64-apple-darwin langchain-serve
 */
const path = require('path');
const fs = require('fs');

/** 递归打印目录结构，prefix 缩进，maxDepth 限制层数避免刷屏 */
function printDirTree(dir, prefix = '', maxDepth = 3) {
  if (maxDepth <= 0) return;
  let names;
  try {
    names = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.log(prefix + '(readdir failed: ' + e.message + ')');
    return;
  }
  names.forEach((dirent, i) => {
    const isLast = i === names.length - 1;
    const branch = isLast ? '└── ' : '├── ';
    const name = dirent.name + (dirent.isDirectory() ? '/' : '');
    console.log(prefix + branch + name);
    if (dirent.isDirectory()) {
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');
      printDirTree(path.join(dir, dirent.name), nextPrefix, maxDepth - 1);
    }
  });
}

function dumpPkgLayout() {
  const parentDir = path.join(__dirname, '..','..');
  console.log('parentDir:', parentDir);
  console.log('[pkg layout] __dirname:', __dirname);
  console.log('process.execPath:', process.execPath);
  console.log('---');

  printDirTree(parentDir);
}

if (process.env.DEBUG_PKG === '1') {
  dumpPkgLayout();
}

const command = process.argv[2];

switch (command) {
  case 'langchain-serve':
    require( './langchain-serve.js');
    break;
  case 'pty-host':
    require( './pty-host.js');
    break;
  default:
    console.error(`[core] unknown command: ${command}`);
    process.exit(1);
}

