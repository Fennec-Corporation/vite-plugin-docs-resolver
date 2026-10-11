import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import { docsResolver } from '../../src/index';

function mdxExamplePlugin(): Plugin {
  return {
    name: 'mdx-example-transform',
    enforce: 'pre',
    transform(code: string, id: string) {
      if (!id.endsWith('.mdx')) {
        return null;
      }

      // 1. Extract ```jsx import ... ``` blocks
      const extraImports: string[] = [];
      let transformed = code.replace(/```jsx\s+import\s*\n([\s\S]*?)\n```/g, (_, imports) => {
        extraImports.push(imports.trim());
        return '';
      });

      // 2. Transform ```tsx example ... ``` blocks into <Example code="...">...</Example>
      transformed = transformed.replace(/```tsx\s+example\s*\n([\s\S]*?)\n```/g, (_, codeBlock) => {
        const trimmed = codeBlock.trim();
        const jsonCode = JSON.stringify(trimmed);

        if (trimmed.startsWith('function ')) {
          const fnBody = trimmed
            .replace(/^function\s+\w+\s*\([^)]*\)\s*\{/, '')
            .replace(/\}\s*$/, '');
          return `\n<Example code={${jsonCode}}>\n{React.createElement(() => {\n${fnBody}\n})}\n</Example>\n`;
        }

        return `\n<Example code={${jsonCode}}>\n<div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>\n${trimmed}\n</div>\n</Example>\n`;
      });

      // 3. Prepend required component and user imports
      const headerImports = [
        "import React from 'react';",
        "import { Example } from './components';",
        ...extraImports,
      ].join('\n');

      return {
        code: `${headerImports}\n\n${transformed}`,
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [
    mdxExamplePlugin(),
    docsResolver(),
    mdx({
      jsxImportSource: 'react',
    }),
    react(),
  ],
});
