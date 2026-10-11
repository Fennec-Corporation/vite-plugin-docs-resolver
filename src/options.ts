import picomatch from 'picomatch';
import type { DocsResolverOptions } from './types';

export interface NormalizedDocsResolverOptions {
  prefix: string;
  sourceFields: string[];
  resolveSource?: DocsResolverOptions['resolveSource'];
  filter: (id: string) => boolean;
  crawlPackages: (pkgName: string) => boolean;
}

export function normalizeOptions(options: DocsResolverOptions = {}): NormalizedDocsResolverOptions {
  const prefix = options.prefix ?? 'docs:';
  const sourceFields = options.sourceFields ?? [
    'source',
    'types:source',
    'module',
    'main',
    'types'
  ];
  const filter = createFilter(options.include, options.exclude);
  const crawlPackages = createPackageFilter(options.crawlPackages);

  return {
    prefix,
    sourceFields,
    resolveSource: options.resolveSource,
    filter,
    crawlPackages
  };
}

export function createFilter(
  include?: DocsResolverOptions['include'],
  exclude?: DocsResolverOptions['exclude']
): (id: string) => boolean {
  const includeMatchers = toMatchers(include);
  const excludeMatchers = toMatchers(exclude);

  return (id: string): boolean => {
    // If exclude matches, reject
    for (const matcher of excludeMatchers) {
      if (matcher(id)) {
        return false;
      }
    }

    // If include is defined, must match at least one
    if (includeMatchers.length > 0) {
      for (const matcher of includeMatchers) {
        if (matcher(id)) {
          return true;
        }
      }
      return false;
    }

    return true;
  };
}

export function createPackageFilter(
  crawlPackages?: DocsResolverOptions['crawlPackages']
): (pkgName: string) => boolean {
  if (!crawlPackages) {
    return () => false;
  }
  if (typeof crawlPackages === 'function') {
    return crawlPackages;
  }
  const matchers = toMatchers(crawlPackages);
  return (pkgName: string) => {
    return matchers.some(matcher => matcher(pkgName));
  };
}

function toMatchers(
  pattern?: string | RegExp | readonly (string | RegExp)[]
): ((str: string) => boolean)[] {
  if (!pattern) {
    return [];
  }

  const list = Array.isArray(pattern) ? pattern : [pattern];
  return list.map(item => {
    if (item instanceof RegExp) {
      return (str: string) => item.test(str);
    }
    if (typeof item === 'string') {
      const isGlob = /[*?[\]{}()!]/.test(item);
      if (isGlob) {
        const isMatch = picomatch(item, { dot: true });
        return (str: string) => {
          const clean = str.replace(/^\.\//, '');
          return isMatch(str) || isMatch(clean);
        };
      }
      return (str: string) => {
        const clean = str.replace(/^\.\//, '');
        return str.includes(item) || clean.includes(item);
      };
    }
    return () => false;
  });
}
