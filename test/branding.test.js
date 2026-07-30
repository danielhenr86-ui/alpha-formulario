'use strict';

const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const projectRoot = join(__dirname, '..');
const html = readFileSync(join(projectRoot, 'index.html'), 'utf8');

test('usa os arquivos oficiais da marca MetOn', () => {
  assert.ok(existsSync(join(projectRoot, 'assets', 'meton-logo-light.png')));
  assert.ok(existsSync(join(projectRoot, 'assets', 'meton-logo-dark.png')));
  assert.ok(existsSync(join(projectRoot, 'assets', 'meton-icon.svg')));

  assert.match(html, /src="\/assets\/meton-logo-light\.png"/);
  assert.match(html, /src="\/assets\/meton-logo-dark\.png"/);
  assert.match(html, /src="\/assets\/meton-icon\.svg"/);
  assert.doesNotMatch(html, /<svg viewBox="-9 -9 432 176"/);
});

test('aplica os tokens centrais do branding', () => {
  assert.match(html, /--grafite:\s*#0E1B17/);
  assert.match(html, /--verde:\s*#12B76A/);
  assert.match(html, /background:\s*var\(--grafite\)/);
  assert.match(html, /border-bottom:\s*5px solid var\(--verde\)/);
});

test('mantém o fluxo principal acessível e identificável', () => {
  assert.match(html, /data-stage="intro"/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuenow/);
  assert.match(html, /type="button" onclick="startQuiz\(\)"/);
});
