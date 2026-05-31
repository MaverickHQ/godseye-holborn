#!/usr/bin/env node
import fs from 'node:fs';
import { chromium, firefox, webkit } from '@playwright/test';

const args = process.argv.slice(2);
const requiredArg = args.find(arg => arg.startsWith('--required=')) ?? '--required=chromium';
const advisoryMode = args.includes('--advisory=1');
const requiredBrowsers = requiredArg
  .replace('--required=', '')
  .split(',')
  .map(item => item.trim().toLowerCase())
  .filter(Boolean);

const browserTypes = {
  chromium,
  firefox,
  webkit,
};

const missing = [];

for (const browserName of requiredBrowsers) {
  const browserType = browserTypes[browserName];
  if (!browserType) {
    missing.push(`${browserName} (unknown browser type)`);
    continue;
  }
  const executablePath = browserType.executablePath();
  if (!fs.existsSync(executablePath)) {
    missing.push(`${browserName} (${executablePath})`);
  }
}

if (missing.length > 0) {
  console.error('[e2e-runtime] Missing Playwright browser runtime(s):');
  for (const item of missing) {
    console.error(`- ${item}`);
  }

  if (advisoryMode) {
    console.warn('[e2e-runtime] Advisory mode enabled; continuing with available browser projects only.');
    process.exit(0);
  }

  console.error(
    `[e2e-runtime] Install missing browsers with: npx playwright install ${requiredBrowsers.join(' ')}`,
  );
  process.exit(1);
}

console.log(`[e2e-runtime] Browser runtime check passed for: ${requiredBrowsers.join(', ')}`);
