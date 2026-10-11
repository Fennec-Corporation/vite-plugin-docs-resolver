/// <reference types="vite/client" />

declare module '*.mdx' {
  import type { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module 'docs:*' {
  import { DocNode } from 'vite-plugin-docs-resolver';
  export const exports: Record<string, DocNode>;
  export const links: Record<string, DocNode>;
  const docs: {
    exports: Record<string, DocNode>;
    links: Record<string, DocNode>;
  };
  export default docs;
}
