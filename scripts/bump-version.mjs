import fs from 'node:fs';

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/bump-version.mjs 0.3.1');
  process.exit(1);
}

function updateJson(path, updater) {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  updater(data);
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

// package.json
updateJson('package.json', (pkg) => {
  pkg.version = version;
});

// package-lock.json
updateJson('package-lock.json', (lock) => {
  lock.version = version;

  if (lock.packages?.['']) {
    lock.packages[''].version = version;
  }
});

// tauri.conf.json
updateJson('src-tauri/tauri.conf.json', (config) => {
  config.version = version;
});

// Cargo.toml
const cargoPath = 'src-tauri/Cargo.toml';
let cargo = fs.readFileSync(cargoPath, 'utf8');

cargo = cargo.replace(
  /^version\s*=\s*"[^"]+"/m,
  `version = "${version}"`
);

fs.writeFileSync(cargoPath, cargo);

console.log(`Version updated to ${version}`);