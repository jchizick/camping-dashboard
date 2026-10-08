import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { capture } from '../../../scripts/previews/workspace/capture-config.mjs';

describe('unified workspace preview asset contract', () => {
  it('ships an opaque lossy WebP with exact dimensions and no metadata', () => {
    const bytes = fs.readFileSync(path.join(process.cwd(), 'public/trips/desktop-workspace-preview.webp'));
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
    expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
    expect(bytes.readUInt32LE(4) + 8).toBe(bytes.length);
    const chunks: string[] = [];
    for (let offset = 12; offset < bytes.length;) {
      const kind = bytes.toString('ascii', offset, offset + 4);
      const length = bytes.readUInt32LE(offset + 4);
      chunks.push(kind);
      if (kind === 'VP8 ') {
        expect(bytes.subarray(offset + 11, offset + 14)).toEqual(Buffer.from([0x9d, 0x01, 0x2a]));
        expect(bytes.readUInt16LE(offset + 14) & 0x3fff).toBe(2560);
        expect(bytes.readUInt16LE(offset + 16) & 0x3fff).toBe(1594);
      }
      offset += 8 + length + (length % 2);
    }
    // VP8 alone excludes alpha planes, metadata, animation, and lossless encoding.
    expect(chunks).toEqual(['VP8 ']);
  });
  it('keeps the capture local with a fixed composition contract', () => {
    expect(capture).toMatchObject({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2,
      wrapper: { width: 1280, height: 797 }, width: 2560, height: 1594, quality: 90,
      selector: '[data-workspace-preview-capture]', locale: 'en-US', timezoneId: 'America/Toronto' });
    expect(capture.scale).toBe(8 / 9);
    const root = process.cwd();
    const script = fs.readFileSync(path.join(root, 'scripts/previews/workspace/capture-workspace.mjs'), 'utf8');
    for (const contract of ["server.listen(0, '127.0.0.1'", 'route.abort()', 'document.fonts.ready',
      'image.decode()', 'Fixture geometry must be stable', 'document.documentElement.dataset.fixtureReady']) {
      expect(script).toContain(contract);
    }
    expect(fs.existsSync(path.join(root, 'src/app/preview-rich'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'src/app/preview'))).toBe(false);
  });
});
