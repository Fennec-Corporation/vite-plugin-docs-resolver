import type { Plugin } from 'vite';

export interface DocsResolverOptions {
  prefix?: string;
  include?: string | RegExp | readonly (string | RegExp)[];
  exclude?: string | RegExp | readonly (string | RegExp)[];
}

export function docsResolver(options: DocsResolverOptions = {}): Plugin {
  const prefix = options.prefix ?? 'docs:';

  return {
    name: 'vite-plugin-docs-resolver',
    resolveId(id: string) {
      if (id.startsWith(prefix)) {
        return `\0${id}`;
      }
      return null;
    },
    load(id: string) {
      if (id.startsWith(`\0${prefix}`)) {
        return 'export const exports = {}; export const links = {}; export default { exports, links };';
      }
      return null;
    }
  };
}

export default docsResolver;
