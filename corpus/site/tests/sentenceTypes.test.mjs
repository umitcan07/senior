import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { sentenceTypeLabel } from '../src/lib/sentenceTypes.ts';
const rows = JSON.parse(readFileSync(new URL('../../../app/public/corptes/data/tokens/intonation/all.json', import.meta.url), 'utf8'));
test('all 171 missing source types receive explicitly marked suggestions without mutation', () => {
 const before = JSON.stringify(rows);
 const missing = rows.filter(t => !t.sentenceType);
 assert.equal(missing.length, 171);
 for (const t of missing) assert.match(sentenceTypeLabel(t), / \(suggested\)$/);
 for (const t of rows.filter(t => t.sentenceType)) assert.equal(sentenceTypeLabel(t), t.sentenceType);
 assert.equal(JSON.stringify(rows), before);
});
test('suggestions never apply to unknown text or interview records', () => {
 assert.equal(sentenceTypeLabel({id:'S1T1_intonation_000',w:'unknown'}), 'Not annotated');
 assert.equal(sentenceTypeLabel({id:'S1T2_intonation_000',w:'where is the wolf'}), 'Not annotated');
 assert.equal(sentenceTypeLabel({id:'S1T1_intonation_000',w:'where is the wolf',sentenceType:'Original'}), 'Original');
});
