import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { resolveSourceFile } from '../src/resolver';
import { crawlDocs } from '../src/crawler';

const tempDir = path.resolve(__dirname, 'temp_resolver_test');

describe('resolveSourceFile', () => {
  beforeEach(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('resolves relative TypeScript file without extension', () => {
    const filePath = path.join(tempDir, 'Button.tsx');
    fs.writeFileSync(filePath, 'export const Button = () => null;');

    const importer = path.join(tempDir, 'index.ts');
    const resolved = resolveSourceFile('./Button', importer, tempDir);

    expect(resolved).toBe(filePath);
  });

  it('resolves directory with index.ts', () => {
    const subDir = path.join(tempDir, 'components');
    fs.mkdirSync(subDir, { recursive: true });
    const indexPath = path.join(subDir, 'index.ts');
    fs.writeFileSync(indexPath, 'export const Input = () => null;');

    const importer = path.join(tempDir, 'App.tsx');
    const resolved = resolveSourceFile('./components', importer, tempDir);

    expect(resolved).toBe(indexPath);
  });

  it('resolves package using source field in package.json', () => {
    const pkgDir = path.join(tempDir, 'node_modules', 'test-lib');
    const srcDir = path.join(pkgDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    const srcIndex = path.join(srcDir, 'index.ts');
    fs.writeFileSync(srcIndex, 'export interface Config { timeout: number; }');

    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({
        name: 'test-lib',
        version: '1.0.0',
        source: 'src/index.ts',
        main: 'dist/index.js'
      })
    );

    const importer = path.join(tempDir, 'main.ts');
    const resolved = resolveSourceFile('test-lib', importer, tempDir);

    expect(resolved).toBe(srcIndex);
  });

  it('respects custom resolveSource hook', () => {
    const customTarget = path.join(tempDir, 'custom.ts');
    fs.writeFileSync(customTarget, 'export const Custom = true;');

    const resolved = resolveSourceFile('virtual:special', undefined, tempDir, {
      resolveSource: (specifier) => {
        if (specifier === 'virtual:special') {
          return customTarget;
        }
      }
    });

    expect(resolved).toBe(customTarget);
  });
});

describe('crawlDocs dependency crawler', () => {
  beforeEach(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('assembles exports and links across imported modules', () => {
    const typesFile = path.join(tempDir, 'types.ts');
    fs.writeFileSync(
      typesFile,
      `
      /** Common styling options. */
      export interface CommonProps {
        className?: string;
      }
      `
    );

    const buttonFile = path.join(tempDir, 'Button.tsx');
    fs.writeFileSync(
      buttonFile,
      `
      import { CommonProps } from './types';

      /** Button component props. */
      export interface ButtonProps extends CommonProps {
        label: string;
      }

      export const Button = (props: ButtonProps) => null;
      `
    );

    const result = crawlDocs(buttonFile, tempDir);

    // Verify main exports
    expect(result.exports.ButtonProps).toBeDefined();
    expect(result.exports.Button).toBeDefined();

    // Verify links contains referenced CommonProps
    const expectedLinkId = `${typesFile}:CommonProps`;
    expect(result.links[expectedLinkId]).toBeDefined();
    expect(result.links[expectedLinkId].name).toBe('CommonProps');
    expect(result.links[expectedLinkId].description).toContain('Common styling options.');
  });

  it('handles circular dependencies gracefully without infinite loop', () => {
    const fileA = path.join(tempDir, 'a.ts');
    const fileB = path.join(tempDir, 'b.ts');

    fs.writeFileSync(
      fileA,
      `
      import { TypeB } from './b';
      export interface TypeA {
        b?: TypeB;
      }
      `
    );

    fs.writeFileSync(
      fileB,
      `
      import { TypeA } from './a';
      export interface TypeB {
        a?: TypeA;
      }
      `
    );

    const result = crawlDocs(fileA, tempDir);
    expect(result.exports.TypeA).toBeDefined();
    expect(result.links[`${fileB}:TypeB`]).toBeDefined();
  });

  it('resolves re-exports in export * declarations', () => {
    const subFile = path.join(tempDir, 'sub.ts');
    fs.writeFileSync(
      subFile,
      `
      export interface SubProps {
        active: boolean;
      }
      `
    );

    const indexFile = path.join(tempDir, 'index.ts');
    fs.writeFileSync(
      indexFile,
      `
      export * from './sub';
      `
    );

    const result = crawlDocs(indexFile, tempDir);
    expect(result.exports.SubProps).toBeDefined();
    expect(result.exports.SubProps.name).toBe('SubProps');
  });

  it('does not crawl external packages by default unless specified in crawlPackages', () => {
    const pkgDir = path.join(tempDir, 'node_modules', 'external-ui');
    fs.mkdirSync(path.join(pkgDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'external-ui', source: 'src/index.ts' })
    );
    fs.writeFileSync(
      path.join(pkgDir, 'src', 'index.ts'),
      'export interface ExternalTheme { dark: boolean; }'
    );

    const mainFile = path.join(tempDir, 'main.ts');
    fs.writeFileSync(
      mainFile,
      `
      import { ExternalTheme } from 'external-ui';
      export interface AppConfig {
        theme: ExternalTheme;
      }
      `
    );

    // Default: does not crawl external-ui
    const resultDefault = crawlDocs(mainFile, tempDir);
    expect(resultDefault.exports.AppConfig).toBeDefined();
    expect(Object.keys(resultDefault.links).some(k => k.includes('external-ui'))).toBe(false);

    // Allowed: crawls external-ui when specified in crawlPackages
    const resultAllowed = crawlDocs(mainFile, tempDir, {
      crawlPackages: ['external-ui']
    });
    expect(resultAllowed.exports.AppConfig).toBeDefined();
    expect(Object.keys(resultAllowed.links).some(k => k.includes('external-ui'))).toBe(true);
  });
});
