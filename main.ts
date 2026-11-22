// Sunset City — make.fun entry program (Node 22+, standard library only).
// Copies game/ and screenshots/ into the output directory and writes dossier.json
// there using the vendored make.fun library. The output directory is
// $MAKEFUN_OUTPUT_DIR, or $OUT_DIR, or ./out next to this file (created if missing).
// When the house mounts the bot directory at /bot (MAKEFUN_BOT_DIR), the game and
// screenshots are read from there instead of the directory beside main.ts.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const botDir = process.env.MAKEFUN_BOT_DIR || null;
const source = botDir ?? here;

const out =
  process.env.MAKEFUN_OUTPUT_DIR ||
  process.env.OUT_DIR ||
  join(here, 'out');

mkdirSync(out, { recursive: true });

// The game itself: plain static files a browser loads offline.
mkdirSync(join(out, 'game'), { recursive: true });
cpSync(join(source, 'game'), join(out, 'game'), { recursive: true });

// Screenshots: 3-4 renders, the first by name is the cover.
mkdirSync(join(out, 'screenshots'), { recursive: true });
const shotsDir = join(source, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
}

// The dossier the judge reads: the scorer's own caps, so what we build here is
// byte-identical to what the scorer would build from the same tree.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`dossier written to ${join(out, 'dossier.json')}`);
