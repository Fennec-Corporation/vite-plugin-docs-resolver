import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { docsResolver } from '../src/index';

const tempDir = path.resolve(__dirname, 'temp_plugin_hooks_test');

describe('docsResolver plugin hooks', () => {
  beforeEach(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('resolves virtual id with prefix and respects exclude filter', () => {
    const plugin = docsResolver({
      prefix: 'docs:',
      exclude: ['**/internal/**']
    });

    const resolveId = plugin.resolveId as Function;

    // Normal specifier
    const res1 = resolveId.call({}, 'docs:./Button', path.join(tempDir, 'index.ts'));
    expect(res1).toBeDefined();
    expect(res1).toContain('\0docs:');

    // Excluded specifier
    const res2 = resolveId.call({}, 'docs:./internal/Secret', path.join(tempDir, 'index.ts'));
    expect(res2).toBeNull();

    // Non-matching prefix
    const res3 = resolveId.call({}, 'other:./Button', path.join(tempDir, 'index.ts'));
    expect(res3).toBeNull();
  });

  it('supports custom prefix option', () => {
    const plugin = docsResolver({
      prefix: 'docgen:'
    });

    const resolveId = plugin.resolveId as Function;
    const res = resolveId.call({}, 'docgen:./Button', path.join(tempDir, 'index.ts'));
    expect(res).toBeDefined();
    expect(res).toContain('\0docgen:');
  });

  it('loads module and emits ESM code with exports and links', async () => {
    const buttonFile = path.join(tempDir, 'Button.tsx');
    fs.writeFileSync(
      buttonFile,
      `
      export interface ButtonProps {
        label: string;
      }
      export const Button = (props: ButtonProps) => null;
      `
    );

    const plugin = docsResolver({ prefix: 'docs:' });
    const configResolved = plugin.configResolved as Function;
    configResolved.call({}, { root: tempDir });

    const resolveId = plugin.resolveId as Function;
    const resolvedId = resolveId.call({}, `docs:${buttonFile}`);

    const load = plugin.load as Function;
    const addedWatchFiles: string[] = [];
    const context = {
      addWatchFile(file: string) {
        addedWatchFiles.push(file);
      }
    };

    const loadedCode = await load.call(context, resolvedId);
    expect(loadedCode).toBeDefined();
    expect(loadedCode).toContain('export const exports = docs.exports;');
    expect(loadedCode).toContain('export const links = docs.links;');
    expect(loadedCode).toContain('export default docs;');
    expect(loadedCode).toContain('ButtonProps');
    expect(addedWatchFiles).toContain(buttonFile);
  });

  it('handleHotUpdate invalidates modules depending on modified file', () => {
    const plugin = docsResolver({ prefix: 'docs:' });
    const handleHotUpdate = plugin.handleHotUpdate as Function;

    const invalidated: any[] = [];
    const mockModule = { id: '\0docs:/mock/Button.tsx' };
    const mockServer = {
      moduleGraph: {
        getModulesByFile(file: string) {
          if (file === '/mock/Button.tsx') {
            return new Set([mockModule]);
          }
          return null;
        },
        invalidateModule(mod: any) {
          invalidated.push(mod);
        }
      }
    };

    const modules = handleHotUpdate.call({}, {
      file: '/mock/Button.tsx',
      server: mockServer,
      modules: []
    });

    expect(invalidated).toContain(mockModule);
    expect(modules).toContain(mockModule);
  });
});
