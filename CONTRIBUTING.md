# Contributing to vite-plugin-docs-resolver

Thank you for your interest in contributing. This document provides guidelines for contributing code, tests, and documentation.

## Development Workflow

### Prerequisites

- Node.js 20 or later
- pnpm 9 or later
- (Optional) Nix with flakes enabled (`nix develop`)

### Initial Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/Fennec-Corporation/vite-plugin-docs-resolver.git
cd vite-plugin-docs-resolver
pnpm install
```

### Common Commands

- **Build plugin:** `pnpm run build`
- **Run tests:** `pnpm test`
- **Run tests in watch mode:** `pnpm run test:watch`
- **Typecheck:** `pnpm run typecheck`
- **Lint code:** `pnpm run lint`
- **Auto-fix lint issues:** `pnpm run lint:fix`
- **Check formatting:** `pnpm run format:check`
- **Format code:** `pnpm run format`
- **Watch plugin build:** `pnpm run dev:plugin`
- **Run example doc site:** `pnpm run example:dev`
- **Build example doc site:** `pnpm run example:build`

## Coding Standards

### TypeScript

- Keep code strictly typed. Avoid `any` unless dealing with arbitrary AST payloads where exact types cannot be statically determined.
- Use explicit return types on exported functions.
- Use `import type` for type-only imports to preserve clean ESM emit.
- Keep abstractions focused and avoid premature complexity.

### Documentation and JSDoc

- Document all exported functions, plugin options, and public interfaces with JSDoc comments.
- Include parameter descriptions, return value explanations, and default values where applicable (`@param`, `@returns`, `@default`).
- Keep documentation clear, concise, and professional. Avoid emojis, placeholders, or verbose filler content.

### Linting and Formatting

Code style and formatting are enforced through ESLint and Prettier.

- Run `pnpm run lint` to inspect source files with ESLint.
- Run `pnpm run lint:fix` to automatically resolve fixable lint warnings and errors.
- Run `pnpm run format:check` to verify that files match Prettier rules.
- Run `pnpm run format` to automatically reformat repository files.

Formatting conventions:

- 2 spaces for indentation.
- Single quotes for strings in TypeScript and JavaScript, double quotes in JSON.
- Semicolons required.
- Standard Unix line endings (`LF`).
- Print width set to 100 characters.

## Commit Guidelines

This project uses the Conventional Commits specification.

Format:

```
<type>(<scope>): <description>
```

Common types:

- `feat`: A new feature or capability
- `fix`: A bug fix
- `docs`: Documentation updates
- `test`: Adding or updating test cases
- `refactor`: Code changes that neither fix a bug nor add a feature
- `chore`: Maintenance, dependencies, or tooling updates

Examples:

- `feat: add support for custom crawl filter function`
- `fix(crawler): resolve circular type aliases gracefully`
- `test(extractor): add test case for forwardRef components`

## Pull Request Process

1. Create a descriptive branch from `master` (`git checkout -b feat/my-feature`).
2. Make your changes adhering to the coding standards above.
3. Add unit or integration tests for new functionality in `tests/`.
4. Verify the entire validation pipeline passes locally:
   ```bash
   pnpm run typecheck
   pnpm run lint
   pnpm run format:check
   pnpm test
   pnpm run build
   ```
5. Commit your changes using Conventional Commits.
6. Push to your fork and submit a Pull Request using the PR template.
