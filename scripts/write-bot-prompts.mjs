import { mkdir, writeFile } from 'node:fs/promises';
import { botInstructions, PUBLISHERS } from '../web/publishing.js';
await mkdir('prompts', { recursive: true });
for (const kind of Object.keys(PUBLISHERS)) await writeFile(`prompts/${kind}.txt`, botInstructions(kind) + '\n', 'utf8');
console.log('Wrote separate reading and listening bot prompts.');
