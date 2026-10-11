import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { createServer, build, type ViteDevServer } from 'vite';
import { docsResolver } from '../src/index';

describe('Vite plugin end-to-end integration', () => {
  let server: ViteDevServer;

  beforeAll(async () => {
    server = await createServer({
      root: __dirname,
      server: {
        middlewareMode: true
      },
      plugins: [docsResolver()]
    });
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  it('ssrLoadModule loads docs from ./fixtures/Button.tsx in dev mode', async () => {
    const mod = await server.ssrLoadModule('docs:./fixtures/Button.tsx');
    expect(mod).toBeDefined();

    const docs = mod.default;
    expect(docs).toBeDefined();
    expect(docs.exports).toBeDefined();
    expect(docs.links).toBeDefined();

    // Verify Button component
    const button = docs.exports.Button;
    expect(button).toBeDefined();
    expect(button.type).toBe('component');
    expect(button.name).toBe('Button');
    expect(button.description).toContain('Primary UI button component.');

    // Verify ButtonProps interface
    const buttonProps = docs.exports.ButtonProps;
    expect(buttonProps).toBeDefined();
    expect(buttonProps.type).toBe('interface');
    expect(buttonProps.properties.label).toBeDefined();
    expect(buttonProps.properties.label.type).toBe('property');
    expect(buttonProps.properties.variant.default).toBe("'primary'");

    // Verify onPress method
    expect(buttonProps.properties.onPress.type).toBe('property');

    // Verify cross-module links to types.ts
    const typesFilePath = path.resolve(__dirname, 'fixtures/types.ts');
    const basePropsId = `${typesFilePath}:BaseProps`;
    const variantId = `${typesFilePath}:ButtonVariant`;

    expect(docs.links[basePropsId]).toBeDefined();
    expect(docs.links[basePropsId].name).toBe('BaseProps');
    expect(docs.links[variantId]).toBeDefined();
    expect(docs.links[variantId].name).toBe('ButtonVariant');

    // Verify inheritance reference is linked
    expect(buttonProps.extends.length).toBeGreaterThan(0);
    expect(buttonProps.extends[0].type).toBe('link');
    expect(buttonProps.extends[0].id).toBe(basePropsId);
  });

  it('ssrLoadModule resolves wildcard and named re-exports from ./fixtures/index.ts', async () => {
    const mod = await server.ssrLoadModule('docs:./fixtures/index.ts');
    const docs = mod.default;

    expect(docs.exports.Button).toBeDefined();
    expect(docs.exports.ButtonProps).toBeDefined();
    expect(docs.exports.BaseProps).toBeDefined();
    expect(docs.exports.ButtonVariant).toBeDefined();
  });

  it('build succeeds in production mode', async () => {
    const output = await build({
      root: __dirname,
      logLevel: 'silent',
      build: {
        write: false,
        rollupOptions: {
          input: 'virtual-entry',
          plugins: [
            {
              name: 'virtual-entry-plugin',
              resolveId(id) {
                if (id === 'virtual-entry') return id;
                return null;
              },
              load(id) {
                if (id === 'virtual-entry') {
                  return `
                    import docs from 'docs:./fixtures/Button.tsx';
                    console.log(docs.exports);
                  `;
                }
                return null;
              }
            }
          ]
        }
      },
      plugins: [docsResolver()]
    });

    expect(output).toBeDefined();
  });
});
