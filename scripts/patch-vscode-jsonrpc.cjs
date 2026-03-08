/**
 * Patches vscode-jsonrpc to add the missing `exports` map needed by
 * @github/copilot-sdk v0.1.32+, which imports `vscode-jsonrpc/node` as an
 * ESM subpath. vscode-jsonrpc 8.x ships without an `exports` field, so Node's
 * strict ESM resolver cannot find the subpath without this patch.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'node_modules', 'vscode-jsonrpc', 'package.json');

try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  if (!pkg.exports || !pkg.exports['./node']) {
    pkg.exports = {
      '.': {
        types: './lib/common/api.d.ts',
        default: './lib/node/main.js',
      },
      // Both `vscode-jsonrpc/node` (without extension) and
      // `vscode-jsonrpc/node.js` (with extension) are used by
      // @github/copilot-sdk, so we must export both subpaths.
      './node': {
        types: './node.d.ts',
        default: './node.js',
      },
      './node.js': {
        types: './node.d.ts',
        default: './node.js',
      },
      './browser': {
        types: './browser.d.ts',
        default: './browser.js',
      },
      './browser.js': {
        types: './browser.d.ts',
        default: './browser.js',
      },
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t') + '\n');
    console.log('patched vscode-jsonrpc exports map');
  }
} catch (err) {
  if (err.code !== 'ENOENT') {
    // vscode-jsonrpc is absent in production-only installs (ENOENT), which is
    // fine. Any other error (permissions, malformed JSON, etc.) is unexpected.
    console.warn('patch-vscode-jsonrpc: unexpected error:', err.message);
  }
}
