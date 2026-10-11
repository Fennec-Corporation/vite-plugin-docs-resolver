import fs from 'node:fs';
import path from 'node:path';
import type { DocsResolverOptions } from './types';

const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.d.ts'];
const INDEX_FILES = ['index.tsx', 'index.ts', 'index.jsx', 'index.js', 'index.d.ts'];
const DEFAULT_SOURCE_FIELDS = ['source', 'types:source', 'module', 'main', 'types'];

export interface ResolverOptions {
  sourceFields?: string[];
  resolveSource?: DocsResolverOptions['resolveSource'];
}

function resolveFileWithExtensions(basePath: string): string | null {
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath;
  }

  for (const ext of EXTENSIONS) {
    const candidate = `${basePath}${ext}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    for (const indexFile of INDEX_FILES) {
      const candidate = path.join(basePath, indexFile);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
  }

  return null;
}

function findPackageDir(packageName: string, startDir: string): string | null {
  let currDir = path.resolve(startDir);
  while (true) {
    const candidate = path.join(currDir, 'node_modules', packageName);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(currDir);
    if (parent === currDir) {
      break;
    }
    currDir = parent;
  }
  return null;
}

export function extractPackageInfo(specifier: string): { packageName: string; subpath: string } {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    const packageName = parts.slice(0, 2).join('/');
    const subpath = parts.slice(2).join('/');
    return { packageName, subpath };
  }

  const parts = specifier.split('/');
  const packageName = parts[0];
  const subpath = parts.slice(1).join('/');
  return { packageName, subpath };
}

export function resolveSourceFile(
  specifier: string,
  importer?: string,
  rootDir: string = process.cwd(),
  options: ResolverOptions = {}
): string | null {
  if (options.resolveSource) {
    const custom = options.resolveSource(specifier, importer);
    if (custom && fs.existsSync(custom)) {
      return path.resolve(custom);
    }
  }

  const baseDir = importer ? path.dirname(importer) : rootDir;

  // Relative or absolute path
  if (specifier.startsWith('.') || path.isAbsolute(specifier)) {
    const targetPath = path.resolve(baseDir, specifier);
    const resolved = resolveFileWithExtensions(targetPath);
    if (resolved) {
      return normalizeToSource(resolved);
    }
    return null;
  }

  // Bare package specifier
  const { packageName, subpath } = extractPackageInfo(specifier);
  const pkgDir = findPackageDir(packageName, baseDir);
  if (!pkgDir) {
    return null;
  }

  const pkgJsonPath = path.join(pkgDir, 'package.json');
  let pkgJson: Record<string, any> = {};
  if (fs.existsSync(pkgJsonPath)) {
    try {
      pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    } catch {
      pkgJson = {};
    }
  }

  const sourceFields = options.sourceFields || DEFAULT_SOURCE_FIELDS;

  if (!subpath) {
    // Check package.json source field directly
    if (pkgJson.source && typeof pkgJson.source === 'string') {
      const sourceTarget = path.resolve(pkgDir, pkgJson.source);
      const resolved = resolveFileWithExtensions(sourceTarget);
      if (resolved) {
        return resolved;
      }
    }

    // Check package.json exports with "source" condition
    if (pkgJson.exports && typeof pkgJson.exports === 'object') {
      const rootExport = pkgJson.exports['.'] || pkgJson.exports;
      if (typeof rootExport === 'object' && rootExport !== null) {
        if (rootExport.source && typeof rootExport.source === 'string') {
          const candidate = resolveFileWithExtensions(path.resolve(pkgDir, rootExport.source));
          if (candidate) return candidate;
        }
      }
    }

    // Check configured fields in order
    for (const field of sourceFields) {
      const target = pkgJson[field];
      if (typeof target === 'string') {
        const candidate = resolveFileWithExtensions(path.resolve(pkgDir, target));
        if (candidate) {
          return normalizeToSource(candidate, pkgDir);
        }
      }
    }

    // Fallback: check src/index.ts or index.ts directly in package dir
    const indexFallback = resolveFileWithExtensions(path.join(pkgDir, 'src', 'index'));
    if (indexFallback) return indexFallback;

    const rootFallback = resolveFileWithExtensions(path.join(pkgDir, 'index'));
    if (rootFallback) return rootFallback;
  } else {
    // Resolve subpath
    const subpathTarget = path.resolve(pkgDir, subpath);
    const resolved = resolveFileWithExtensions(subpathTarget);
    if (resolved) {
      return normalizeToSource(resolved, pkgDir);
    }

    // Check under src/
    const srcSubpath = path.resolve(pkgDir, 'src', subpath);
    const srcResolved = resolveFileWithExtensions(srcSubpath);
    if (srcResolved) {
      return srcResolved;
    }
  }

  return null;
}

function normalizeToSource(filePath: string, pkgDir?: string): string {
  if (filePath.endsWith('.d.ts')) {
    // Try corresponding .ts / .tsx in same directory
    const tsFile = filePath.replace(/\.d\.ts$/, '.ts');
    if (fs.existsSync(tsFile)) return tsFile;

    const tsxFile = filePath.replace(/\.d\.ts$/, '.tsx');
    if (fs.existsSync(tsxFile)) return tsxFile;

    // Check if monorepo package with dist/... -> src/index.ts
    if (pkgDir) {
      const srcIndex = path.join(pkgDir, 'src', 'index.ts');
      if (fs.existsSync(srcIndex)) return srcIndex;

      const srcIndexTsx = path.join(pkgDir, 'src', 'index.tsx');
      if (fs.existsSync(srcIndexTsx)) return srcIndexTsx;
    } else {
      const parentDir = path.dirname(filePath);
      const srcCandidate = path.resolve(parentDir, '..', 'src', 'index.ts');
      if (fs.existsSync(srcCandidate)) return srcCandidate;
    }
  }

  return filePath;
}
