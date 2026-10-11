# vite-plugin-docs-resolver

A Vite plugin to extract component documentation, prop types, and TypeScript metadata from source code, inspired by the Adobe React Spectrum documentation architecture.

When importing with the `docs:` prefix, the plugin parses the target TypeScript or JavaScript source code using Babel AST and Doctrine, crawls referenced type dependencies to assemble cross-module links, and emits an executable ESM module.

## Installation

```bash
pnpm add -D vite-plugin-docs-resolver
```

## Vite Configuration

Add `docsResolver` to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { docsResolver } from 'vite-plugin-docs-resolver';

export default defineConfig({
  plugins: [
    docsResolver({
      prefix: 'docs:', // default prefix
      sourceFields: ['source', 'types:source', 'module', 'main', 'types']
    })
  ]
});
```

## Plugin Options

| Option | Type | Default | Description |
|---|---|---|---|
| `prefix` | `string` | `'docs:'` | Import specifier prefix to intercept |
| `include` | `string \| RegExp \| (string \| RegExp)[]` | `undefined` | Filter specifiers to include (supports glob strings or regex) |
| `exclude` | `string \| RegExp \| (string \| RegExp)[]` | `undefined` | Filter specifiers to exclude |
| `crawlPackages` | `string \| RegExp \| (string \| RegExp)[] \| ((pkg: string) => boolean)` | `undefined` | Specific packages allowed to be crawled for links (e.g. monorepo packages) |
| `sourceFields` | `string[]` | `['source', 'types:source', 'module', 'main', 'types']` | `package.json` fields to check when resolving packages to source files |
| `resolveSource` | `(specifier: string, importer?: string) => string \| undefined` | `undefined` | Custom resolver function to override source file resolution |

## Usage

### In JavaScript or TypeScript

```typescript
import docs from 'docs:./components/Button';

console.log(docs.exports.Button);
console.log(docs.exports.ButtonProps);
console.log(docs.links);
```

You can also import named exports directly:

```typescript
import { exports, links } from 'docs:@my-scope/ui';
```

### In MDX

```mdx
import docs from 'docs:@react-spectrum/s2';

<PropsTable
  docs={docs.exports.Form}
  links={docs.links}
  props={['size', 'labelPosition', 'necessityIndicator', 'isRequired']}
/>
```

## Output Structure

The imported module exports:

```typescript
export interface DocsPayload {
  exports: Record<string, DocNode>;
  links: Record<string, DocNode>;
}

export const exports: Record<string, DocNode>;
export const links: Record<string, DocNode>;
export default DocsPayload;
```

- `exports`: A map of symbol names exported by the target file (interfaces, components, functions, types, classes).
- `links`: A map of fully qualified IDs (`<filePath>:<typeName>`) for all external types referenced by the entrypoint across imported files. Referenced types in `exports` contain `{ type: 'link', id: '<filePath>:<typeName>' }` allowing renderers to inspect referenced types.

## Development

```bash
# Build bundle
pnpm run build

# Run unit and integration tests
pnpm test

# Typecheck
pnpm run typecheck
```

## License

Apache-2.0. Contains modified code derived from Adobe React Spectrum (see NOTICE.txt).
