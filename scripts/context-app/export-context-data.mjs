/**
 * Переносимый экспортёр context-app-data — для прототипов ЛЮБОГО стека,
 * умеющих запускать Node на сборке. Вход: модуль-реестр (.mjs c default
 * export'ом или .json) формы {prototypeId, title, areas, features} + папка
 * docs/<featureId>/**.md. Выход: <out>/{manifest.json, docs/…} по контракту
 * (docs/context-app-data-contract.md). generatedAt ставит сам экспортёр.
 *
 * CLI: node tools/export-context-data.mjs --input registry.mjs --docs docs --out public/context-app-data
 */
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateManifest } from './context-data-schema.mjs';

async function loadRegistry(input) {
  if (input.endsWith('.json')) return JSON.parse(await readFile(input, 'utf8'));
  const mod = await import(pathToFileURL(path.resolve(input)).href);
  return mod.default;
}

export async function exportContextData({ input, docs, out }) {
  const registry = await loadRegistry(input);
  const manifest = { ...registry, generatedAt: new Date().toISOString(), docs: {} };

  await rm(out, { recursive: true, force: true });
  await mkdir(path.join(out, 'docs'), { recursive: true });

  let docsFeatures = 0;
  for (const f of registry.features ?? []) {
    const src = path.join(docs, f.id);
    const exists = await stat(src).then((s) => s.isDirectory()).catch(() => false);
    if (!exists) continue;
    const paths = [];
    const walk = async (dir, rel) => {
      for (const e of await readdir(dir, { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) await walk(path.join(dir, e.name), r);
        else if (e.name.endsWith('.md')) paths.push(r);
      }
    };
    await walk(src, '');
    if (!paths.length) continue;
    manifest.docs[f.id] = paths.sort();
    docsFeatures += 1;
    await cp(src, path.join(out, 'docs', f.id), {
      recursive: true,
      filter: (p) => !path.basename(p).startsWith('.') && (path.extname(p) === '' || p.endsWith('.md')),
    });
  }

  const problems = validateManifest(manifest);
  if (problems.length) throw new Error(`context-app-data contract violations:\n${problems.join('\n')}`);

  await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
  return { features: (registry.features ?? []).length, docsFeatures };
}

// ── CLI ──
const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const arg = (name) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const input = arg('input');
  const docs = arg('docs');
  const out = arg('out');
  if (!input || !docs || !out) {
    console.error('usage: node tools/export-context-data.mjs --input <registry.mjs|json> --docs <dir> --out <dir>');
    process.exit(1);
  }
  exportContextData({ input, docs, out }).then(
    (r) => console.log(`context-app-data: ${r.features} features, docs for ${r.docsFeatures} → ${out}`),
    (err) => {
      console.error(err.message);
      process.exit(1);
    },
  );
}
