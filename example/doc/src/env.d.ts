/// <reference types="vite/client" />

declare module '*.mdx' {
  import type { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module 'docs:*' {
  export const exports: Record<string, any>;
  export const links: Record<string, any>;
  const docs: {
    exports: Record<string, any>;
    links: Record<string, any>;
  };
  export default docs;
}
