import { describe, it, expect } from 'vitest';
import { docsResolver } from '../src/index';

describe('docsResolver plugin initialization', () => {
  it('creates plugin with default name and prefix', () => {
    const plugin = docsResolver();
    expect(plugin.name).toBe('vite-plugin-docs-resolver');
    expect(typeof plugin.resolveId).toBe('function');
    expect(typeof plugin.load).toBe('function');
  });

  it('resolves virtual module ids matching prefix', () => {
    const plugin = docsResolver();
    const resolveId = plugin.resolveId as Function;
    expect(resolveId.call({}, 'docs:./Button')).toBe('\0docs:./Button');
    expect(resolveId.call({}, 'other:./Button')).toBeNull();
  });
});
