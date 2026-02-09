import { build } from 'esbuild';
import { rmSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Step 1: Bundle tsc output into a single file
await build({
  entryPoints: ['dist/index.js'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/index.js',
  allowOverwrite: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});

// Step 2: Clean up tsc artifacts that are no longer needed
const distDir = 'dist';
for (const entry of readdirSync(distDir)) {
  const fullPath = join(distDir, entry);
  if (entry === 'index.js') continue;
  if (statSync(fullPath).isDirectory()) {
    rmSync(fullPath, { recursive: true });
  } else {
    rmSync(fullPath);
  }
}

console.log('Bundled dist/index.js (single file, all dependencies included)');
