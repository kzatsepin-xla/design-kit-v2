/**
 * Валидация контракта context-app-data/manifest.json — то, что движок реально
 * читает (src/lib/types.ts). Возвращает список проблем строками; пустой список
 * = валидно. Без зависимостей — переиспользуется CLI-валидатором и экспортёром.
 */

const isStr = (v) => typeof v === 'string' && v.length > 0;

export function validateManifest(m) {
  const problems = [];
  if (m === null || typeof m !== 'object' || Array.isArray(m)) {
    return ['manifest: must be a JSON object'];
  }
  for (const f of ['prototypeId', 'title', 'generatedAt']) {
    if (!isStr(m[f])) problems.push(`manifest.${f}: required non-empty string`);
  }
  if (!Array.isArray(m.areas) || !m.areas.every(isStr)) problems.push('manifest.areas: required string[]');
  if (m.docs === undefined || typeof m.docs !== 'object' || m.docs === null || Array.isArray(m.docs)) {
    problems.push('manifest.docs: must be an object {featureId: paths[]}');
  }
  if (!Array.isArray(m.features)) {
    problems.push('manifest.features: required array');
    return problems;
  }
  m.features.forEach((feat, i) => {
    const at = `features[${i}]`;
    if (feat === null || typeof feat !== 'object') {
      problems.push(`${at}: must be an object`);
      return;
    }
    for (const f of ['id', 'title', 'summary']) {
      if (!isStr(feat[f])) problems.push(`${at}.${f}: required non-empty string`);
    }
    if (feat.flowMap !== undefined) validateFlowMap(feat.flowMap, `${at}.flowMap`, problems);
  });
  return problems;
}

function validateFlowMap(map, at, problems) {
  if (map === null || typeof map !== 'object') {
    problems.push(`${at}: must be an object`);
    return;
  }
  if (!isStr(map.title)) problems.push(`${at}.title: required non-empty string`);
  if (!Array.isArray(map.flows) || !map.flows.every((f) => f && isStr(f.id) && isStr(f.label))) {
    problems.push(`${at}.flows: required [{id, label}]`);
  }
  if (!Array.isArray(map.nodes)) {
    problems.push(`${at}.nodes: required array`);
    return;
  }
  const nodeIds = new Set();
  map.nodes.forEach((n, i) => {
    const nat = `${at}.nodes[${i}]`;
    if (!n || !isStr(n.id) || !isStr(n.label) || !isStr(n.flowId)) {
      problems.push(`${nat}: requires id, label, flowId`);
      return;
    }
    nodeIds.add(n.id);
    if (!n.target || !isStr(n.target.sectionId)) problems.push(`${nat}.target.sectionId: required (deep link into the prototype)`);
  });
  if (!Array.isArray(map.edges)) {
    problems.push(`${at}.edges: required array`);
    return;
  }
  map.edges.forEach((e, i) => {
    const eat = `${at}.edges[${i}]`;
    if (!e || !isStr(e.from) || !isStr(e.to)) {
      problems.push(`${eat}: requires from, to`);
      return;
    }
    for (const end of [e.from, e.to]) {
      if (!nodeIds.has(end)) problems.push(`${eat}: references unknown node "${end}"`);
    }
  });
}
