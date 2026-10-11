import fs from 'node:fs';
import path from 'node:path';
import { extractDocs } from './extractor';
import { resolveSourceFile, extractPackageInfo } from './resolver';
import { normalizeOptions } from './options';
import type { DocNode, DocsPayload, ExtractedFileDocs, DocsResolverOptions } from './types';

export function crawlDocs(
  entryFilePath: string,
  rootDir: string = process.cwd(),
  options: DocsResolverOptions = {}
): DocsPayload {
  if (!fs.existsSync(entryFilePath)) {
    return { exports: {}, links: {} };
  }

  const opts = normalizeOptions(options);
  const visitedFiles = new Set<string>();
  const fileDocsMap = new Map<string, ExtractedFileDocs>();
  const queue: string[] = [entryFilePath];

  // 1. Breadth-first traversal to discover all dependencies
  while (queue.length > 0) {
    const currentFile = queue.shift()!;
    if (visitedFiles.has(currentFile)) {
      continue;
    }
    visitedFiles.add(currentFile);

    try {
      const code = fs.readFileSync(currentFile, 'utf-8');
      const docInfo = extractDocs(code, currentFile);
      fileDocsMap.set(currentFile, docInfo);

      for (const dep of docInfo.dependencies) {
        const isLocal = dep.specifier.startsWith('.') || path.isAbsolute(dep.specifier);
        if (!isLocal) {
          const { packageName } = extractPackageInfo(dep.specifier);
          if (!opts.crawlPackages(packageName)) {
            continue;
          }
        }

        const resolvedDep = resolveSourceFile(dep.specifier, currentFile, rootDir, opts);
        if (resolvedDep && !visitedFiles.has(resolvedDep) && fs.existsSync(resolvedDep)) {
          queue.push(resolvedDep);
        }
      }
    } catch {
      // Ignore unparseable or inaccessible dependency files gracefully
    }
  }

  // 2. Build the flat links map from all crawled files
  const links: Record<string, DocNode> = {};
  for (const [filePath, docInfo] of fileDocsMap.entries()) {
    for (const [exportName, exportNode] of Object.entries(docInfo.exports)) {
      const id = exportNode.id || `${filePath}:${exportName}`;
      links[id] = exportNode;
    }
  }

  // 3. Assemble entry exports and resolve re-exports
  const entryDocs = fileDocsMap.get(entryFilePath);
  const finalExports: Record<string, DocNode> = { ...(entryDocs?.exports || {}) };

  if (entryDocs?.dependencies) {
    for (const dep of entryDocs.dependencies) {
      const isLocal = dep.specifier.startsWith('.') || path.isAbsolute(dep.specifier);
      if (!isLocal) {
        const { packageName } = extractPackageInfo(dep.specifier);
        if (!opts.crawlPackages(packageName)) {
          continue;
        }
      }

      const resolvedDepPath = resolveSourceFile(dep.specifier, entryFilePath, rootDir, opts);
      if (!resolvedDepPath) continue;

      const depDocs = fileDocsMap.get(resolvedDepPath);
      if (!depDocs) continue;

      if (dep.isAll) {
        for (const [name, node] of Object.entries(depDocs.exports)) {
          if (!finalExports[name]) {
            finalExports[name] = node;
          }
        }
      } else {
        for (const [exportedName, localName] of dep.symbols.entries()) {
          const targetNode = depDocs.exports[localName] || depDocs.exports[exportedName];
          if (targetNode && !finalExports[exportedName]) {
            finalExports[exportedName] = targetNode;
          }
        }
      }
    }
  }

  // 4. Transform references to type: 'link' pointing to links map
  function linkReferences(node: any, currentFilePath: string) {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (node.type === 'reference' && node.specifier && node.imported) {
      const isLocal = node.specifier.startsWith('.') || path.isAbsolute(node.specifier);
      let shouldLink = isLocal;
      if (!isLocal) {
        const { packageName } = extractPackageInfo(node.specifier);
        shouldLink = opts.crawlPackages(packageName);
      }

      if (shouldLink) {
        const resolvedTarget = resolveSourceFile(node.specifier, currentFilePath, rootDir, opts);
        if (resolvedTarget) {
          const targetId = `${resolvedTarget}:${node.imported}`;
          node.type = 'link';
          node.id = targetId;
        }
      }
    }

    for (const key of Object.keys(node)) {
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          linkReferences(item, currentFilePath);
        }
      } else if (value && typeof value === 'object') {
        linkReferences(value, currentFilePath);
      }
    }
  }

  for (const exp of Object.values(finalExports)) {
    linkReferences(exp, entryFilePath);
  }

  for (const [id, linkNode] of Object.entries(links)) {
    const colonIdx = id.lastIndexOf(':');
    const nodeFile = colonIdx > 0 ? id.slice(0, colonIdx) : entryFilePath;
    linkReferences(linkNode, nodeFile);
  }

  return {
    exports: finalExports,
    links,
  };
}
