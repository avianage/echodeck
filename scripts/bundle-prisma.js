const fs = require('fs');
const path = require('path');

fs.mkdirSync('/prisma-bundle/node_modules', {recursive: true});

function copy(src, dst) {
  const stat = fs.lstatSync(src);
  if (stat.isSymbolicLink()) {
    const target = fs.readlinkSync(src);
    fs.symlinkSync(target, dst);
  } else if (stat.isDirectory()) {
    fs.mkdirSync(dst, {recursive: true});
    for (const entry of fs.readdirSync(src)) {
      copy(path.join(src, entry), path.join(dst, entry));
    }
  } else {
    fs.copyFileSync(src, dst);
  }
}

function collectDeps(pkgDir, collected) {
  const p = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(p)) return;
  const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
  const all = {...pkg.dependencies || {}, ...pkg.peerDependencies || {}};
  for (const d of Object.keys(all)) {
    if (collected.has(d)) continue;
    collected.add(d);
    const dp = path.join('/app/node_modules', d);
    if (fs.existsSync(dp)) collectDeps(dp, collected);
  }
}

const deps = new Set();
collectDeps('/app/node_modules/prisma', deps);

const bundle = '/prisma-bundle/node_modules';
copy('/app/node_modules/prisma', path.join(bundle, 'prisma'));
copy('/app/node_modules/@prisma', path.join(bundle, '@prisma'));

fs.mkdirSync(path.join(bundle, '.bin'), {recursive: true});
copy('/app/node_modules/.bin/prisma', path.join(bundle, '.bin', 'prisma'));

for (const d of deps) {
  if (d.startsWith('@prisma/')) continue;
  const src = path.join('/app/node_modules', d);
  const dst = path.join(bundle, d);
  if (fs.existsSync(src) && !fs.existsSync(dst))
    copy(src, dst);
}

console.log('Prisma bundle created with', deps.size, 'deps');
