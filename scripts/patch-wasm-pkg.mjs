import fs from 'node:fs';
import path from 'node:path';

const packageJsonPath = path.resolve(process.cwd(), 'src/core/wasm/pkg/package.json');

if (fs.existsSync(packageJsonPath)) {
  const packageContent = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageContent.license = 'MIT';
  packageContent.author = 'ciclista';
  packageContent.repository = {
    type: 'git',
    url: 'https://github.com/cristhian-godoy/ciclista',
  };
  packageContent.exports = {
    '.': {
      types: './ciclista_wasm.d.ts',
      import: './ciclista_wasm.js',
    },
  };
  packageContent.files = ['ciclista_wasm_bg.wasm', 'ciclista_wasm.d.ts'];
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageContent, null, 2) + '\n');
}
