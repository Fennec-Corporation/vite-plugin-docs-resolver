/**
 * Visibility modifier for class members and properties.
 */
export type AccessModifier = 'public' | 'protected' | 'private';

/**
 * Base node representation for all extracted AST documentation elements.
 */
export interface BaseDocNode {
  /**
   * Node kind identifier (e.g. 'interface', 'property', 'component', 'function').
   */
  type: string;

  /**
   * Fully qualified identifier in format `<filePath>:<symbolName>`.
   */
  id?: string | null;

  /**
   * Identifier name of the symbol.
   */
  name?: string | null;

  /**
   * Main text description extracted from JSDoc comments.
   */
  description?: string | null;

  /**
   * Member access level extracted from code or JSDoc tags.
   */
  access?: AccessModifier | string;

  /**
   * Default value extracted from JSDoc @default tag or parameter assignment.
   */
  default?: string | null;
}

/**
 * Documentation node for an object or interface property.
 */
export interface PropertyDocNode extends BaseDocNode {
  type: 'property';

  /**
   * Property key name.
   */
  name: string;

  /**
   * Type representation of the property value.
   */
  value: DocNode;

  /**
   * Whether the property is optional (marked with `?`).
   */
  optional?: boolean;

  /**
   * Access modifier (public, protected, private).
   */
  access?: AccessModifier | string;

  /**
   * Index key type if this property represents an index signature.
   */
  indexType?: DocNode;
}

/**
 * Documentation node for a function or method parameter.
 */
export interface ParameterDocNode {
  type: 'parameter';

  /**
   * Parameter identifier name.
   */
  name: string;

  /**
   * Type representation of the parameter.
   */
  value: DocNode;

  /**
   * Whether the parameter is optional.
   */
  optional?: boolean;

  /**
   * Whether this parameter is a rest element (`...args`).
   */
  rest?: boolean;

  /**
   * Description extracted from JSDoc @param tag.
   */
  description?: string | null;

  /**
   * Default parameter value if specified.
   */
  default?: string | null;
}

/**
 * Documentation node for a standalone function.
 */
export interface FunctionDocNode extends BaseDocNode {
  type: 'function';

  /**
   * List of function parameters.
   */
  parameters: ParameterDocNode[];

  /**
   * Function return type.
   */
  return: DocNode;

  /**
   * Generic type parameters.
   */
  typeParameters: DocNode[];

  /**
   * Usage examples extracted from JSDoc @example tags.
   */
  examples?: string[] | null;
}

/**
 * Documentation node for a class method.
 */
export interface MethodDocNode extends BaseDocNode {
  type: 'method';

  /**
   * Method name.
   */
  name: string;

  /**
   * Function signature of the method.
   */
  value: FunctionDocNode;

  /**
   * Whether the method is static.
   */
  static?: boolean;

  /**
   * Whether the method is abstract.
   */
  abstract?: boolean;
}

/**
 * Documentation node for a TypeScript interface or class declaration.
 */
export interface InterfaceDocNode extends BaseDocNode {
  type: 'interface';

  /**
   * Fully qualified identifier `<filePath>:<interfaceName>`.
   */
  id: string;

  /**
   * Interface name.
   */
  name: string;

  /**
   * List of extended interfaces or base classes.
   */
  extends: DocNode[];

  /**
   * Map of property and method names to their documentation nodes.
   */
  properties: Record<string, PropertyDocNode | MethodDocNode>;

  /**
   * Generic type parameters declared on the interface.
   */
  typeParameters: DocNode[];
}

/**
 * Documentation node for a React component (function component or forwardRef).
 */
export interface ComponentDocNode extends BaseDocNode {
  type: 'component';

  /**
   * Fully qualified identifier `<filePath>:<componentName>`.
   */
  id?: string | null;

  /**
   * Component name.
   */
  name?: string | null;

  /**
   * Extracted props type definition.
   */
  props?: DocNode | null;

  /**
   * Extracted ref type definition for forwardRef components.
   */
  ref?: DocNode | null;

  /**
   * Generic type parameters declared on the component.
   */
  typeParameters?: DocNode[];

  /**
   * Code examples extracted from JSDoc @example tags.
   */
  examples?: string[] | null;
}

/**
 * Documentation node for a TypeScript type alias (`type X = ...`).
 */
export interface TypeAliasDocNode extends BaseDocNode {
  type: 'alias';

  /**
   * Fully qualified identifier `<filePath>:<aliasName>`.
   */
  id: string;

  /**
   * Type alias name.
   */
  name: string;

  /**
   * Underlying type definition.
   */
  value: DocNode;

  /**
   * Generic type parameters declared on the type alias.
   */
  typeParameters?: DocNode[];
}

/**
 * Documentation node for a union type (`A | B`).
 */
export interface UnionDocNode extends BaseDocNode {
  type: 'union';

  /**
   * List of member types in the union.
   */
  elements: DocNode[];
}

/**
 * Documentation node for an intersection type (`A & B`).
 */
export interface IntersectionDocNode extends BaseDocNode {
  type: 'intersection';

  /**
   * List of types combined in the intersection.
   */
  types: DocNode[];
}

/**
 * Documentation node for an array type (`T[]`).
 */
export interface ArrayDocNode extends BaseDocNode {
  type: 'array';

  /**
   * Element type of the array.
   */
  elementType: DocNode;
}

/**
 * Documentation node for a tuple type (`[A, B]`).
 */
export interface TupleDocNode extends BaseDocNode {
  type: 'tuple';

  /**
   * Ordered element types of the tuple.
   */
  elements: DocNode[];
}

/**
 * Documentation node representing an unresolved import reference.
 */
export interface ReferenceDocNode extends BaseDocNode {
  type: 'reference';

  /**
   * Local binding name in the importing file.
   */
  local: string;

  /**
   * Exported name in the source module.
   */
  imported: string;

  /**
   * Module specifier path from the import statement.
   */
  specifier: string;
}

/**
 * Documentation node representing an unresolved local identifier.
 */
export interface IdentifierDocNode extends BaseDocNode {
  type: 'identifier';

  /**
   * Identifier name.
   */
  name: string;
}

/**
 * Documentation node for generic type instantiation (`T<A, B>`).
 */
export interface ApplicationDocNode extends BaseDocNode {
  type: 'application';

  /**
   * Base generic type.
   */
  base: DocNode;

  /**
   * Type arguments applied to the generic type.
   */
  typeParameters: DocNode[];
}

/**
 * Union of all possible documentation AST node types.
 */
export type DocNode =
  | InterfaceDocNode
  | ComponentDocNode
  | TypeAliasDocNode
  | PropertyDocNode
  | MethodDocNode
  | FunctionDocNode
  | UnionDocNode
  | IntersectionDocNode
  | ArrayDocNode
  | TupleDocNode
  | ReferenceDocNode
  | IdentifierDocNode
  | ApplicationDocNode
  | BaseDocNode
  | any;

/**
 * Extracted import or export dependency from a source file.
 */
export interface ExtractedDependency {
  /**
   * Import specifier path.
   */
  specifier: string;

  /**
   * Map of imported symbol names to local variable names.
   */
  symbols: Map<string, string>;

  /**
   * True if this represents a wildcard re-export (`export * from '...'`).
   */
  isAll?: boolean;
}

/**
 * Parsed documentation and dependencies extracted from a single source file.
 */
export interface ExtractedFileDocs {
  /**
   * Absolute path of the source file.
   */
  filePath: string;

  /**
   * Map of exported symbol names to their documentation nodes.
   */
  exports: Record<string, DocNode>;

  /**
   * List of dependencies imported or re-exported by the file.
   */
  dependencies: ExtractedDependency[];
}

/**
 * Parsed JSDoc comment metadata extracted via Doctrine.
 */
export interface JSDocMetadata {
  /**
   * Main comment description text.
   */
  description?: string;

  /**
   * Value from @default tag.
   */
  default?: string;

  /**
   * Value from @access, @public, @protected, or @private tag.
   */
  access?: string;

  /**
   * Return description from @return or @returns tag.
   */
  return?: string;

  /**
   * Selector description from @selector tag.
   */
  selector?: string;

  /**
   * Parameter descriptions mapped by parameter name from @param tags.
   */
  params?: Record<string, string>;

  /**
   * Code examples from @example tags.
   */
  examples?: string[];
}

/**
 * Payload emitted by the virtual module `docs:<specifier>`.
 */
export interface DocsPayload {
  /**
   * Map of top-level exported symbols from the target entrypoint.
   */
  exports: Record<string, DocNode>;

  /**
   * Map of referenced type IDs (`<filePath>:<name>`) to their type definitions.
   */
  links: Record<string, DocNode>;
}

/**
 * Configuration options for the vite-plugin-docs-resolver plugin.
 */
export interface DocsResolverOptions {
  /**
   * Import prefix to intercept. Defaults to `'docs:'`.
   */
  prefix?: string;

  /**
   * Pattern or list of patterns to include.
   */
  include?: string | RegExp | readonly (string | RegExp)[];

  /**
   * Pattern or list of patterns to exclude.
   */
  exclude?: string | RegExp | readonly (string | RegExp)[];

  /**
   * Package names or patterns allowed to be crawled for links.
   * By default, third-party packages in node_modules are not crawled.
   */
  crawlPackages?:
    | string
    | RegExp
    | readonly (string | RegExp)[]
    | ((pkgName: string) => boolean);

  /**
   * Fields in package.json to inspect for source code in order of precedence.
   * Defaults to `['source', 'types:source', 'module', 'main', 'types']`.
   */
  sourceFields?: string[];

  /**
   * Custom hook to resolve import specifiers to source files.
   */
  resolveSource?: (specifier: string, importer?: string) => string | undefined;
}
