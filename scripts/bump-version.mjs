import fs from 'node:fs';

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/bump-version.mjs 0.3.1');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid version: ${version}`);
  console.error('Expected format: x.y.z (e.g. 0.3.1)');
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

// README.md
const readmePath = 'README.md';
let readme = fs.readFileSync(readmePath, 'utf8');

// Latest release version
readme = readme.replace(
  /\[\*\*v\d+\.\d+\.\d+\*\*\]\(https:\/\/github\.com\/hyeyeonghwang\/productivity-timer\/releases\/tag\/v\d+\.\d+\.\d+\)/,
  `[**v${version}**](https://github.com/hyeyeonghwang/productivity-timer/releases/tag/v${version})`
);

// Installer filename
readme = readme.replace(
  /Productivity Timer_\d+\.\d+\.\d+_x64-setup\.exe/g,
  `Productivity Timer_${version}_x64-setup.exe`
);

// Release download path
readme = readme.replace(
  /\/download\/v\d+\.\d+\.\d+\//g,
  `/download/v${version}/`
);

// Installer filename in URL
readme = readme.replace(
  /Productivity\.Timer_\d+\.\d+\.\d+_x64-setup\.exe/g,
  `Productivity.Timer_${version}_x64-setup.exe`
);

fs.writeFileSync(readmePath, readme);

console.log(`Version updated to ${version}`);