import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Owner directive (2026-09-17): every screen this app serves must show a
 * visible, always-present link to its public repository. This is a
 * single-page app, so that means index.html's one screen. Parsed with
 * happy-dom's DOMParser rather than a regex, so the assertions are about
 * the actual element (attributes, visible text), not incidental substrings.
 */
describe('GitHub source link', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');

  it('is present, outside any [hidden] control, with the required attributes and text', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const link = doc.getElementById('github-source-link');

    expect(link).not.toBeNull();
    expect(link!.tagName).toBe('A');
    expect(link!.getAttribute('href')).toBe('https://github.com/geoffmyers/multitrack-audio-visualizer');
    expect(link!.getAttribute('target')).toBe('_blank');
    expect(link!.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link!.textContent.trim()).toContain('View source on GitHub');
    expect(link!.hasAttribute('hidden')).toBe(false);

    // It must live inside #controls (rendered on this app's one screen,
    // never behind a hidden panel), not merely somewhere in the document.
    const controls = doc.getElementById('controls');
    expect(controls).not.toBeNull();
    expect(controls!.contains(link)).toBe(true);
  });

  it('carries the mark-github icon inline, so no CSP change is needed to show it', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const link = doc.getElementById('github-source-link');

    const svg = link!.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.querySelector('path')).not.toBeNull();
  });
});
