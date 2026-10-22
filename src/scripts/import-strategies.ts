import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { StrategyCatalogImporter } from '../modules/strategy-library/strategy-catalog.importer.js';
import { MAX_BUNDLE_BYTES } from '../modules/strategy-library/importer.js';

function parseArguments(argv: string[]) {
  const flags = { commit: false, sourceId: undefined as string | undefined, file: undefined as string | undefined };
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--commit') flags.commit = true;
    else if (arg === '--source') flags.sourceId = argv[++index];
    else positional.push(arg);
  }
  flags.file = positional[0];
  return flags;
}

const cwd = process.cwd();
const flags = parseArguments(process.argv.slice(2));

if (!flags.file) {
  process.stderr.write('Usage: import-strategies <bundle.json> [--commit --source <sourceId>]\n');
  process.exit(2);
}

const target = resolve(cwd, flags.file);
if (relative(cwd, target).startsWith('..')) {
  process.stderr.write(`Refusing to read outside the working directory: ${flags.file}\n`);
  process.exit(2);
}

const raw = await readFile(target, 'utf8');
if (Buffer.byteLength(raw, 'utf8') > MAX_BUNDLE_BYTES) {
  process.stderr.write(`Bundle exceeds the maximum size of ${MAX_BUNDLE_BYTES} bytes\n`);
  process.exit(2);
}

const application = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
try {
  const importer = application.get(StrategyCatalogImporter);

  if (!flags.commit) {
    const report = importer.dryRun(raw);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(report.ok ? 0 : 1);
  }

  if (!flags.sourceId) {
    process.stderr.write('--commit requires --source <sourceId>\n');
    process.exit(2);
  }

  const result = await importer.persist(raw, { sourceId: flags.sourceId });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.ok ? 0 : 1);
} finally {
  await application.close();
}
