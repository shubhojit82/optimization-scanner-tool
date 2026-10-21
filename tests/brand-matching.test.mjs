import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'fs';

// Transpile brand-matching.ts on the fly (same pattern as core.test.mjs)
const src = readFileSync('./src/core/brand-matching.ts', 'utf8')
    .replace(/^import type.*\n/gm, '');
const js = ts.transpileModule(src, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
}).outputText;
const mod = {exports: {}};
new Function('exports', 'require', js)(mod.exports, () => ({}));
const {mentionsBrand} = mod.exports;

const c = {name: 'WorldFinancialgroup', brandAliases: []};

test('spaced form matches (World Financial Group)',     () => assert.ok(mentionsBrand(c, 'World Financial Group offers insurance.')));
test('run-together lowercase matches',                  () => assert.ok(mentionsBrand(c, 'worldfinancialgroup is mentioned here.')));
test('hyphenated form matches',                         () => assert.ok(mentionsBrand(c, 'world-financial-group operates in the US.')));
test('all-caps spaced matches',                         () => assert.ok(mentionsBrand(c, 'WORLD FINANCIAL GROUP dominates the market.')));
test('acronym WFG does not match',                      () => assert.ok(!mentionsBrand(c, 'WFG is a financial company.')));
test('competitor name does not match',                  () => assert.ok(!mentionsBrand(c, 'Primerica is a competitor.')));
test('short partial word does not false-positive',      () => assert.ok(!mentionsBrand(c, 'world is a big place.')));
test('alias match works',                               () => { const c2 = {name: 'Acme', brandAliases: ['ACME Corp']}; assert.ok(mentionsBrand(c2, 'ACME Corp is the best.')); });
test('already-spaced name still works',                 () => { const c3 = {name: 'World Financial Group', brandAliases: []}; assert.ok(mentionsBrand(c3, 'World Financial Group is trusted.')); });
