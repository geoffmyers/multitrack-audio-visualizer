import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigParser } from '../config';

/**
 * Regression test for the built-in presets having ONE source of truth.
 *
 * There used to be two hand-kept copies: presets/all-presets.json (read by
 * ConfigParser here) and public/presets/all-presets.json (fetched by the
 * browser, PresetManager.ts). Nothing checked they agreed, so it was
 * possible to edit one and silently leave the CLI and the browser offering
 * a different set of built-in presets. There is now only public/presets/ --
 * this test pins ConfigParser to read that single file, so a future PR that
 * reintroduces a second copy (or points the CLI somewhere else) fails here
 * instead of drifting unnoticed.
 */
describe('ConfigParser.loadPresets()', () => {
  const presetsPath = path.join(process.cwd(), 'public', 'presets', 'all-presets.json');

  it('reads public/presets/all-presets.json -- the same file the browser fetches', async () => {
    const parser = new ConfigParser();
    const onDisk = JSON.parse(await fs.readFile(presetsPath, 'utf-8'));

    const loaded = await parser.loadPresets();

    expect(loaded).toEqual(onDisk);
  });

  it('has no second presets/all-presets.json left to drift from', async () => {
    const legacyPath = path.join(process.cwd(), 'presets', 'all-presets.json');

    await expect(fs.access(legacyPath)).rejects.toThrow();
  });

  it('caches the result rather than re-reading the file on every call', async () => {
    const parser = new ConfigParser();

    const first = await parser.loadPresets();
    const second = await parser.loadPresets();

    expect(second).toBe(first); // same array instance, not just equal content
  });

  it('exposes every built-in preset by name, sorted', async () => {
    const parser = new ConfigParser();

    const names = await parser.listPresetNames();

    expect(names.length).toBeGreaterThan(0);
    expect(names).toEqual([...names].sort());
  });
});
