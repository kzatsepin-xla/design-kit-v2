#!/usr/bin/env node
/**
 * CLI: node tools/validate-context-data.mjs <dir-with-context-app-data>
 * Проверяет manifest.json по контракту + существование задекларированных доков.
 * Exit 0 — валидно, 1 — есть проблемы (печатаются построчно).
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { validateManifest } from './context-data-schema.mjs';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node tools/validate-context-data.mjs <dir>');
  process.exit(1);
}

const problems = [];
let manifest;
try {
  manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
} catch (err) {
  console.error(`cannot read ${dir}/manifest.json: ${err.message}`);
  process.exit(1);
}
problems.push(...validateManifest(manifest));

for (const [featureId, files] of Object.entries(manifest.docs ?? {})) {
  for (const rel of files) {
    const p = path.join(dir, 'docs', featureId, rel);
    const ok = await stat(p).then((s) => s.isFile()).catch(() => false);
    if (!ok) problems.push(`docs.${featureId}: declared file missing on disk: docs/${featureId}/${rel}`);
  }
}

if (problems.length) {
  problems.forEach((p) => console.error(`✗ ${p}`));
  process.exit(1);
}
console.log(`✓ ${dir}: valid context-app-data (${manifest.features.length} features)`);
