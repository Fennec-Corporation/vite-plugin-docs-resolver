import type { Plugin, ModuleNode } from 'vite';
import type { DocsResolverOptions } from './types';
import { normalizeOptions } from './options';
import { resolveSourceFile } from './resolver';
import { crawlDocs } from './crawler';

export * from './types';
export { extractDocs } from './extractor';
export { resolveSourceFile } from './resolver';
export { crawlDocs } from './crawler';
export { normalizeOptions, createFilter } from './options';

export function docsResolver(options: DocsResolverOptions = {}): Plugin {
  const opts = normalizeOptions(options);
  const prefix = opts.prefix;

  let rootDir = process.cwd();

  // Maps virtual id -> absolute source file path
  const virtualToSourceMap = new Map<string, string>();
  // Maps source file path -> Set of virtual module ids that depend on it
  const fileToDocModulesMap = new Map<string, Set<string>>();

  return {
    name: 'vite-plugin-docs-resolver',

    configResolved(config) {
      if (config.root) {
        rootDir = config.root;
      }
    },

    resolveId(id: string, importer?: string) {
      if (!id.startsWith(prefix)) {
        return null;
      }

      const rawSpecifier = id.slice(prefix.length);
      if (!opts.filter(rawSpecifier)) {
        return null;
      }

      const resolvedSource = resolveSourceFile(rawSpecifier, importer, rootDir, opts);
      const targetPath = resolvedSource || rawSpecifier;
      const virtualId = `\0${prefix}${targetPath}`;

      if (resolvedSource) {
        virtualToSourceMap.set(virtualId, resolvedSource);
      }

      return virtualId;
    },

    load(id: string) {
      if (!id || !id.startsWith(`\0${prefix}`)) {
        return null;
      }

      const resolvedSource =
        virtualToSourceMap.get(id) || id.slice(`\0${prefix}`.length);

      const docsPayload = crawlDocs(resolvedSource, rootDir, opts);

      // Track all contributing files for watch and HMR
      const contributingFiles = new Set<string>();
      if (resolvedSource) {
        contributingFiles.add(resolvedSource);
      }

      for (const linkId of Object.keys(docsPayload.links)) {
        const colonIdx = linkId.lastIndexOf(':');
        if (colonIdx > 0) {
          const filePath = linkId.slice(0, colonIdx);
          if (filePath) {
            contributingFiles.add(filePath);
          }
        }
      }

      for (const file of contributingFiles) {
        try {
          this.addWatchFile(file);
        } catch {
          // In some test contexts addWatchFile might not be present on this
        }

        let moduleSet = fileToDocModulesMap.get(file);
        if (!moduleSet) {
          moduleSet = new Set<string>();
          fileToDocModulesMap.set(file, moduleSet);
        }
        moduleSet.add(id);
      }

      const serialized = JSON.stringify(docsPayload);

      return `const docs = ${serialized};\nexport const exports = docs.exports;\nexport const links = docs.links;\nexport default docs;\n`;
    },

    handleHotUpdate(ctx) {
      const { file, server, modules } = ctx;
      const affectedModules = new Set<ModuleNode>(modules || []);

      const virtualModuleIds = fileToDocModulesMap.get(file);
      if (virtualModuleIds) {
        for (const vId of virtualModuleIds) {
          const mod = server.moduleGraph.getModuleById(vId);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
            affectedModules.add(mod);
          }
        }
      }

      // Check module graph by file in case direct match exists
      const fileModules = server.moduleGraph.getModulesByFile(file);
      if (fileModules) {
        for (const mod of fileModules) {
          if (mod.id && mod.id.startsWith(`\0${prefix}`)) {
            server.moduleGraph.invalidateModule(mod);
            affectedModules.add(mod);
          }
        }
      }

      return Array.from(affectedModules);
    }
  };
}

export default docsResolver;
