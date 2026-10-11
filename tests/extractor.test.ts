import { describe, it, expect } from 'vitest';
import { extractDocs } from '../src/extractor';

describe('extractDocs AST extraction', () => {
  it('extracts TypeScript interface with properties, methods, and JSDoc tags', () => {
    const code = `
      /**
       * Button properties for styling and accessibility.
       */
      export interface ButtonProps {
        /**
         * The visual style of the button.
         * @default 'primary'
         */
        variant?: 'primary' | 'secondary' | 'quiet';

        /**
         * Whether the button is disabled.
         * @default false
         */
        isDisabled?: boolean;

        /**
         * Handler called when the button is clicked.
         * @param event The mouse event
         */
        onPress?(event: any): void;
      }
    `;

    const result = extractDocs(code, '/mock/Button.tsx');
    expect(result.exports.ButtonProps).toBeDefined();

    const iface = result.exports.ButtonProps as any;
    expect(iface.type).toBe('interface');
    expect(iface.name).toBe('ButtonProps');
    expect(iface.id).toBe('/mock/Button.tsx:ButtonProps');
    expect(iface.description).toContain('Button properties for styling and accessibility.');

    // Variant property
    expect(iface.properties.variant).toBeDefined();
    expect(iface.properties.variant.type).toBe('property');
    expect(iface.properties.variant.optional).toBe(true);
    expect(iface.properties.variant.default).toBe("'primary'");
    expect(iface.properties.variant.value.type).toBe('union');

    // isDisabled property
    expect(iface.properties.isDisabled.type).toBe('property');
    expect(iface.properties.isDisabled.value.type).toBe('boolean');
    expect(iface.properties.isDisabled.default).toBe('false');

    // onPress method
    expect(iface.properties.onPress).toBeDefined();
    expect(iface.properties.onPress.type).toBe('method');
  });

  it('extracts React functional component and forwardRef', () => {
    const code = `
      import React from 'react';

      export interface ButtonProps {
        isDisabled?: boolean;
      }

      /**
       * A standard button component.
       */
      export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
        return <button disabled={props.isDisabled} />;
      });
    `;

    const result = extractDocs(code, '/mock/Button.tsx');
    expect(result.exports.Button).toBeDefined();

    const component = result.exports.Button as any;
    expect(component.type).toBe('component');
    expect(component.name).toBe('Button');
    expect(component.description).toContain('A standard button component.');
  });

  it('extracts type aliases and unions', () => {
    const code = `
      /**
       * Supported size options.
       */
      export type Size = 'small' | 'medium' | 'large';
    `;

    const result = extractDocs(code, '/mock/types.ts');
    expect(result.exports.Size).toBeDefined();

    const alias = result.exports.Size as any;
    expect(alias.type).toBe('alias');
    expect(alias.name).toBe('Size');
    expect(alias.description).toContain('Supported size options.');
    expect(alias.value.type).toBe('union');
    expect(alias.value.elements.length).toBe(3);
  });

  it('tracks re-exports and import dependencies', () => {
    const code = `
      export { Modal } from './Modal';
      export * from './dialog';
      import { Theme } from './theme';

      export interface DialogProps {
        theme?: Theme;
      }
    `;

    const result = extractDocs(code, '/mock/index.ts');
    expect(result.dependencies.length).toBe(3);

    const modalDep = result.dependencies.find(d => d.specifier === './Modal');
    expect(modalDep).toBeDefined();
    expect(modalDep?.symbols.get('Modal')).toBe('Modal');

    const dialogDep = result.dependencies.find(d => d.specifier === './dialog');
    expect(dialogDep).toBeDefined();
    expect(dialogDep?.isAll).toBe(true);

    const themeDep = result.dependencies.find(d => d.specifier === './theme');
    expect(themeDep).toBeDefined();
    expect(themeDep?.symbols.get('Theme')).toBe('Theme');
  });

  it('extracts class declarations with methods, getters, and properties', () => {
    const code = `
      export class StateManager<T extends object> {
        /**
         * Current active state.
         */
        public state: T;

        constructor(initialState: T) {
          this.state = initialState;
        }

        /**
         * Reset the state.
         * @param newState The replacement state
         * @return The updated state
         */
        public reset(newState: T): T {
          this.state = newState;
          return this.state;
        }

        public get isValid(): boolean {
          return true;
        }
      }
    `;

    const result = extractDocs(code, '/mock/StateManager.ts');
    expect(result.exports.StateManager).toBeDefined();

    const cls = result.exports.StateManager as any;
    expect(cls.type).toBe('interface');
    expect(cls.name).toBe('StateManager');
    expect(cls.properties.state.type).toBe('property');
    expect(cls.properties.state.access).toBe('public');
    expect(cls.properties.reset.type).toBe('method');
    expect(cls.properties.reset.value.parameters[0].name).toBe('newState');
    expect(cls.properties.reset.value.parameters[0].description).toBe('The replacement state');
    expect(cls.properties.reset.value.return.description).toBe('The updated state');
    expect(cls.properties.isValid.type).toBe('property');
    expect(cls.properties.isValid.value.type).toBe('boolean');
  });

  it('extracts index signatures and tuple types', () => {
    const code = `
      export interface Dictionary {
        [key: string]: number;
      }

      export type Coordinates = [number, number];
    `;

    const result = extractDocs(code, '/mock/data.ts');
    const dict = result.exports.Dictionary as any;
    expect(dict.properties.key).toBeDefined();
    expect(dict.properties.key.indexType.type).toBe('string');
    expect(dict.properties.key.value.type).toBe('number');

    const coords = result.exports.Coordinates as any;
    expect(coords.value.type).toBe('tuple');
    expect(coords.value.elements.length).toBe(2);
  });
});
