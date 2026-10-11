import { parse } from '@babel/parser';
import traverseModule, { type NodePath, type Binding } from '@babel/traverse';
import * as t from '@babel/types';
import doctrine from 'doctrine';
import type {
  DocNode,
  ExtractedDependency,
  ExtractedFileDocs,
  JSDocMetadata,
  ParameterDocNode
} from './types';

// Handle ESM / CJS interoperability for @babel/traverse
const traverse = (typeof traverseModule === 'function'
  ? traverseModule
  : (traverseModule as any).default) as typeof traverseModule;

export function extractDocs(code: string, filePath: string): ExtractedFileDocs {
  const nodeCache = new Map<any, any>();
  const dependencies: ExtractedDependency[] = [];
  const exports: Record<string, DocNode> = {};

  const ast = parse(code, {
    sourceFilename: filePath,
    allowReturnOutsideFunction: true,
    strictMode: false,
    sourceType: 'module',
    plugins: [
      'classProperties',
      'exportDefaultFrom',
      'exportNamespaceFrom',
      'dynamicImport',
      'typescript',
      'jsx',
      'classPrivateProperties',
      'classPrivateMethods',
      'importAttributes'
    ]
  });

  function addDependency(specifier: string, symbols: Map<string, string>, isAll = false) {
    const existing = dependencies.find(d => d.specifier === specifier);
    if (existing) {
      if (isAll) {
        existing.isAll = true;
      }
      for (const [imported, local] of symbols.entries()) {
        existing.symbols.set(imported, local);
      }
    } else {
      dependencies.push({
        specifier,
        symbols: new Map(symbols),
        isAll
      });
    }
  }

  traverse(ast, {
    ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
      if (path.node.source) {
        const symbols = new Map<string, string>();
        for (const specifier of path.node.specifiers) {
          if (t.isExportSpecifier(specifier)) {
            const exportedName = t.isIdentifier(specifier.exported)
              ? specifier.exported.name
              : specifier.exported.value;
            const localName = specifier.local.name;
            symbols.set(exportedName, localName);
          }
        }
        addDependency(path.node.source.value, symbols);
      } else if (path.node.declaration) {
        const decl = path.node.declaration;
        if (t.isIdentifier((decl as any).id)) {
          const name = (decl as any).id.name;
          const prev = exports[name];
          const val = processExport(path.get('declaration') as NodePath);
          if (val) {
            exports[name] = val;
            if (!exports[name].description && prev?.description) {
              exports[name].description = prev.description;
            }
          }
        } else if (t.isVariableDeclaration(decl)) {
          const declPath = path.get('declaration') as NodePath<t.VariableDeclaration>;
          const declarations = declPath.get('declarations');
          for (const declarator of declarations) {
            const id = declarator.node.id;
            if (t.isIdentifier(id)) {
              const name = id.name;
              exports[name] = processExport(declarator);
            }
          }
        }
      } else if (path.node.specifiers.length > 0) {
        for (const specifier of path.node.specifiers) {
          if (t.isExportSpecifier(specifier)) {
            const exportedName = t.isIdentifier(specifier.exported)
              ? specifier.exported.name
              : specifier.exported.value;
            const binding = path.scope.getBinding(specifier.local.name);
            if (binding) {
              const value = processExport(binding.path);
              if (value && typeof value === 'object') {
                if (value.name) {
                  value.name = exportedName;
                }
                exports[exportedName] = value;
              }
            }
          }
        }
      }
    },

    ExportAllDeclaration(path: NodePath<t.ExportAllDeclaration>) {
      addDependency(
        path.node.source.value,
        new Map([['*', '*']]),
        true
      );
    },

    ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
      const decl = path.get('declaration');
      const val = processExport(decl as NodePath);
      if (val) {
        exports['default'] = val;
      }
    }
  });

  function processExport(path: NodePath | null | undefined, node: any = {}): any {
    if (!path || !path.node) {
      return null;
    }

    if (nodeCache.has(path.node)) {
      return nodeCache.get(path.node);
    }

    nodeCache.set(path.node, node);
    return processPath(path, node);
  }

  function processPath(path: NodePath, node: any): any {
    if (path.isTSParenthesizedType()) {
      return processExport(path.get('typeAnnotation') as NodePath, node);
    }

    if (path.isTSAsExpression()) {
      return processExport(path.get('expression') as NodePath, node);
    }

    if (path.isVariableDeclarator()) {
      const init = path.get('init') as NodePath;
      const idNode = path.node.id as t.Identifier;
      const name = idNode?.name ?? 'unknown';

      if (!path.node.init) {
        node.id = `${filePath}:${name}`;
        node.name = name;
        return Object.assign(node, { type: 'any' });
      }

      const docs = getJSDocs(path.parentPath);
      processExport(init, node);
      addDocs(node, docs);

      if (node.type === 'interface' || node.type === 'component') {
        node.id = `${filePath}:${name}`;
        node.name = name;
      }
      return node;
    }

    if (isReactForwardRef(path)) {
      const args = path.get('arguments') as NodePath[];
      return processExport(args[0], node);
    }

    if (path.isClassDeclaration()) {
      const properties: Record<string, any> = {};
      const bodyPaths = path.get('body.body') as NodePath[];
      for (const propPath of bodyPaths) {
        const prop = processExport(propPath);
        if (prop && prop.name) {
          properties[prop.name] = prop;
        }
      }

      const exts = path.node.superClass
        ? [processExport(path.get('superClass') as NodePath)]
        : [];
      const docs = getJSDocs(path);
      const name = path.node.id?.name ?? '';

      return Object.assign(
        node,
        addDocs(
          {
            type: 'interface',
            id: `${filePath}:${name}`,
            name,
            extends: exts,
            properties,
            typeParameters: path.node.typeParameters
              ? (path.get('typeParameters.params') as NodePath[]).map(p => processExport(p))
              : []
          },
          docs
        )
      );
    }

    if (path.isClassProperty()) {
      const name = t.isStringLiteral(path.node.key)
        ? path.node.key.value
        : (path.node.key as t.Identifier).name;
      const docs = getJSDocs(path);
      const typeAnnotation = path.get('typeAnnotation.typeAnnotation') as NodePath;

      return Object.assign(
        node,
        addDocs(
          {
            type: 'property',
            name,
            value: typeAnnotation ? processExport(typeAnnotation) : { type: 'any' },
            optional: path.node.optional || false,
            access: path.node.accessibility
          },
          docs
        )
      );
    }

    if (path.isObjectExpression()) {
      const properties: Record<string, any> = {};
      const propPaths = path.get('properties') as NodePath[];
      for (const propPath of propPaths) {
        const prop = processExport(propPath);
        if (prop && prop.name) {
          properties[prop.name] = prop;
        }
      }

      return Object.assign(node, {
        type: 'interface',
        extends: [],
        properties,
        typeParameters: []
      });
    }

    if (path.isObjectProperty()) {
      const name = t.isStringLiteral(path.node.key)
        ? path.node.key.value
        : (path.node.key as t.Identifier).name;
      const docs = getJSDocs(path);

      return Object.assign(
        node,
        addDocs(
          {
            type: 'property',
            name,
            value: processExport(path.get('value') as NodePath),
            optional: false
          },
          docs
        )
      );
    }

    if (path.isClassMethod() || (path as any).isTSDeclareMethod?.() || path.isObjectMethod()) {
      const methodNode = path.node as any;
      const key = methodNode.key;
      const name = t.isStringLiteral(key)
        ? key.value
        : (key as t.Identifier).name;
      const docs = getJSDocs(path);

      let value: any;
      if (methodNode.kind === 'get') {
        value = methodNode.returnType
          ? processExport(path.get('returnType.typeAnnotation') as NodePath)
          : { type: 'any' };
      } else if (methodNode.kind === 'set') {
        value = methodNode.params[0] && (methodNode.params[0] as any).typeAnnotation
          ? processExport(path.get('params.0.typeAnnotation.typeAnnotation') as NodePath)
          : { type: 'any' };
      } else {
        const params = path.get('params') as NodePath[];
        value = {
          type: 'function',
          parameters: params.map(processParameter),
          return: methodNode.returnType
            ? processExport(path.get('returnType.typeAnnotation') as NodePath)
            : { type: 'void' },
          typeParameters: methodNode.typeParameters
            ? (path.get('typeParameters.params') as NodePath[]).map(p => processExport(p))
            : []
        };
      }

      return Object.assign(
        node,
        addDocs(
          {
            type: value.type === 'function' ? 'method' : 'property',
            name,
            value,
            access: methodNode.accessibility,
            static: methodNode.static
          },
          docs
        )
      );
    }

    if (path.isFunction() || path.isTSDeclareFunction()) {
      const fnNode = path.node as t.FunctionDeclaration;
      if (isReactComponent(path)) {
        const params = path.get('params') as NodePath[];
        const propsParam = params[0];
        const refParam = params[1];
        const docs = getJSDocs(path);
        const name = fnNode.id ? fnNode.id.name : null;

        return Object.assign(node, {
          type: 'component',
          id: name ? `${filePath}:${name}` : null,
          name,
          props: propsParam && (propsParam.node as any).typeAnnotation
            ? processExport(propsParam.get('typeAnnotation.typeAnnotation') as NodePath)
            : null,
          typeParameters: fnNode.typeParameters
            ? (path.get('typeParameters.params') as NodePath[]).map(p => processExport(p))
            : [],
          ref: refParam && (refParam.node as any).typeAnnotation
            ? processExport(refParam.get('typeAnnotation.typeAnnotation') as NodePath)
            : null,
          description: docs.description || null,
          examples: docs.examples || null
        });
      } else {
        const docs = getJSDocs(path);
        const params = path.get('params') as NodePath[];
        const name = fnNode.id ? fnNode.id.name : null;

        return Object.assign(
          node,
          addDocs(
            {
              type: 'function',
              id: name ? `${filePath}:${name}` : null,
              name,
              parameters: params.map(processParameter),
              return: fnNode.returnType
                ? processExport(path.get('returnType.typeAnnotation') as NodePath)
                : { type: 'any' },
              typeParameters: fnNode.typeParameters
                ? (path.get('typeParameters.params') as NodePath[]).map(p => processExport(p))
                : []
            },
            docs
          )
        );
      }
    }

    if (path.isTSTypeReference()) {
      if (path.node.typeParameters) {
        const base = processExport(path.get('typeName') as NodePath);
        const resolvedTypeParams = (path.get('typeParameters.params') as NodePath[]).map(p =>
          processExport(p)
        );
        return Object.assign(node, {
          type: 'application',
          base,
          typeParameters: resolvedTypeParams
        });
      }

      return processExport(path.get('typeName') as NodePath, node);
    }

    if (path.isTSQualifiedName()) {
      const left = processExport(path.get('left') as NodePath);
      if (left) {
        if (left.type === 'interface' || left.type === 'object') {
          const property = left.properties?.[path.node.right.name];
          if (property) {
            return property.value;
          }
        }

        const leftName = left.name ?? (path.node.left as any).name ?? '';
        return Object.assign(node, {
          type: 'identifier',
          name: `${leftName}.${path.node.right.name}`
        });
      }
    }

    if (path.isImportSpecifier()) {
      const parent = path.parent as t.ImportDeclaration;
      const importedName = t.isIdentifier(path.node.imported)
        ? path.node.imported.name
        : path.node.imported.value;
      const localName = path.node.local.name;

      addDependency(parent.source.value, new Map([[importedName, localName]]));

      return Object.assign(node, {
        type: 'reference',
        local: localName,
        imported: importedName,
        specifier: parent.source.value
      });
    }

    if (path.isImportDefaultSpecifier()) {
      const parent = path.parent as t.ImportDeclaration;
      const localName = path.node.local.name;

      addDependency(parent.source.value, new Map([['default', localName]]));

      return Object.assign(node, {
        type: 'reference',
        local: localName,
        imported: 'default',
        specifier: parent.source.value
      });
    }

    if (path.isTSTypeAliasDeclaration()) {
      const docs = getJSDocs(path);
      const name = path.node.id.name;

      return Object.assign(node, {
        type: 'alias',
        id: `${filePath}:${name}`,
        name,
        value: processExport(path.get('typeAnnotation') as NodePath),
        typeParameters: path.node.typeParameters
          ? (path.get('typeParameters.params') as NodePath[]).map(p => processExport(p))
          : [],
        description: docs.description || null,
        access: docs.access
      });
    }

    if (path.isTSMappedType()) {
      return Object.assign(node, {
        type: 'mapped',
        readonly: path.node.readonly,
        typeParameter: {
          ...processExport(path.get('typeParameter') as NodePath),
          isMappedType: true
        },
        typeAnnotation: processExport(path.get('typeAnnotation') as NodePath)
      });
    }

    if (path.isTSInterfaceDeclaration()) {
      const properties: Record<string, any> = {};
      const bodyPaths = path.get('body.body') as NodePath[];
      for (const propPath of bodyPaths) {
        const property = processExport(propPath);
        if (property && property.name) {
          const prev = properties[property.name];
          if (!property.description && prev?.description) {
            property.description = prev.description;
          }
          properties[property.name] = property;
        }
      }

      const exts = path.node.extends
        ? (path.get('extends') as NodePath[]).map(e => processExport(e))
        : [];
      const docs = getJSDocs(path);
      const name = path.node.id.name;

      const res = Object.assign(
        node,
        addDocs(
          {
            type: 'interface',
            id: `${filePath}:${name}`,
            name,
            extends: exts,
            properties,
            typeParameters: path.node.typeParameters
              ? (path.get('typeParameters.params') as NodePath[]).map(p => processExport(p))
              : []
          },
          docs
        )
      );

      if (res.access === 'private') {
        for (const prop in res.properties) {
          res.properties[prop].access = 'private';
        }
      }
      return res;
    }

    if (path.isTSTypeLiteral()) {
      const properties: Record<string, any> = {};
      const memberPaths = path.get('members') as NodePath[];
      for (const member of memberPaths) {
        const property = processExport(member);
        if (property && property.name) {
          properties[property.name] = property;
        }
      }

      return Object.assign(node, {
        type: 'object',
        properties
      });
    }

    if (path.isTSTypeOperator()) {
      if (path.node.operator === 'keyof') {
        return Object.assign(node, {
          type: 'keyof',
          keyof: processExport(path.get('typeAnnotation') as NodePath)
        });
      }

      return Object.assign(node, {
        type: 'typeOperator',
        operator: path.node.operator,
        value: processExport(path.get('typeAnnotation') as NodePath)
      });
    }

    if (path.isTSThisType()) {
      return Object.assign(node, { type: 'this' });
    }

    if (path.isTSPropertySignature()) {
      let name = 'unknown';
      if (t.isStringLiteral(path.node.key)) {
        name = path.node.key.value;
      } else if (t.isNumericLiteral(path.node.key)) {
        name = String(path.node.key.value);
      } else if (t.isIdentifier(path.node.key)) {
        name = path.node.key.name;
      }

      const docs = getJSDocs(path);
      const value = processExport(path.get('typeAnnotation.typeAnnotation') as NodePath);

      return Object.assign(
        node,
        addDocs(
          {
            type: 'property',
            name,
            value,
            optional: path.node.optional || false
          },
          docs
        )
      );
    }

    if (path.isTSMethodSignature()) {
      const name = t.isStringLiteral(path.node.key)
        ? path.node.key.value
        : (path.node.key as t.Identifier).name;
      const docs = getJSDocs(path);
      const params = path.get('parameters') as NodePath[];

      return Object.assign(
        node,
        addDocs(
          {
            type: 'method',
            name,
            value: {
              type: 'function',
              parameters: params.map(processParameter),
              return: path.node.typeAnnotation
                ? processExport(path.get('typeAnnotation.typeAnnotation') as NodePath)
                : { type: 'any' },
              typeParameters: path.node.typeParameters
                ? (path.get('typeParameters.params') as NodePath[]).map(p => processExport(p))
                : []
            }
          },
          docs
        )
      );
    }

    if (path.isTSIndexSignature()) {
      const param = path.node.parameters[0];
      const name = (param as t.Identifier).name;
      const docs = getJSDocs(path);

      return Object.assign(
        node,
        addDocs(
          {
            type: 'property',
            name,
            indexType: processExport(path.get('parameters.0.typeAnnotation.typeAnnotation') as NodePath),
            value: processExport(path.get('typeAnnotation.typeAnnotation') as NodePath)
          },
          docs
        )
      );
    }

    if (
      path.isTSExpressionWithTypeArguments() ||
      (path as any).isTSInstantiationExpression?.()
    ) {
      const exprNode = path.node as any;
      if (exprNode.typeParameters) {
        return Object.assign(node, {
          type: 'application',
          base: processExport(path.get('expression') as NodePath),
          typeParameters: (path.get('typeParameters.params') as NodePath[]).map(p =>
            processExport(p)
          )
        });
      }

      return processExport(path.get('expression') as NodePath, node);
    }

    if (path.isIdentifier()) {
      const binding = path.scope.getBinding(path.node.name);
      if (!binding) {
        return Object.assign(node, {
          type: 'identifier',
          name: path.node.name
        });
      }

      // Check if binding comes from an import
      if (
        binding.path.isImportSpecifier() ||
        binding.path.isImportDefaultSpecifier() ||
        binding.path.isImportNamespaceSpecifier()
      ) {
        return processExport(binding.path, node);
      }

      return processExport(binding.path, node);
    }

    if (path.isTSSymbolKeyword()) return Object.assign(node, { type: 'symbol' });
    if (path.isTSBooleanKeyword()) return Object.assign(node, { type: 'boolean' });
    if (path.isTSStringKeyword()) return Object.assign(node, { type: 'string' });
    if (path.isTSNumberKeyword()) return Object.assign(node, { type: 'number' });
    if (path.isTSAnyKeyword()) return Object.assign(node, { type: 'any' });
    if (path.isTSNullKeyword()) return Object.assign(node, { type: 'null' });
    if (path.isTSUndefinedKeyword()) return Object.assign(node, { type: 'undefined' });
    if (path.isTSVoidKeyword()) return Object.assign(node, { type: 'void' });
    if (path.isTSObjectKeyword()) return Object.assign(node, { type: 'object' });
    if (path.isTSUnknownKeyword()) return Object.assign(node, { type: 'unknown' });
    if (path.isTSNeverKeyword()) return Object.assign(node, { type: 'never' });

    if (path.isTSArrayType()) {
      return Object.assign(node, {
        type: 'array',
        elementType: processExport(path.get('elementType') as NodePath)
      });
    }

    if (path.isTSUnionType()) {
      const typePaths = path.get('types') as NodePath[];
      return Object.assign(node, {
        type: 'union',
        elements: typePaths.map(t => processExport(t))
      });
    }

    if (path.isTSLiteralType()) {
      const literal = path.node.literal;
      if (t.isTemplateLiteral(literal)) {
        const exprPaths = path.get('literal.expressions') as NodePath[];
        const expressions = exprPaths.map(e => processExport(e));
        const elements: any[] = [];
        let i = 0;
        for (const q of literal.quasis) {
          if (q.value.raw) {
            elements.push({
              type: 'string',
              value: q.value.raw
            });
          }
          if (!q.tail) {
            elements.push(expressions[i++]);
          }
        }

        return Object.assign(node, {
          type: 'template',
          elements
        });
      }

      return Object.assign(node, {
        type: typeof (literal as any).value,
        value: (literal as any).value
      });
    }

    if (path.isTSFunctionType() || path.isTSConstructorType()) {
      const params = path.get('parameters') as NodePath[];
      return Object.assign(node, {
        type: 'function',
        parameters: params.map(processParameter),
        return: path.node.typeAnnotation
          ? processExport(path.get('typeAnnotation.typeAnnotation') as NodePath)
          : { type: 'any' },
        typeParameters: path.node.typeParameters
          ? (path.get('typeParameters.params') as NodePath[]).map(p => processExport(p))
          : []
      });
    }

    if (path.isTSIntersectionType()) {
      const typePaths = path.get('types') as NodePath[];
      return Object.assign(node, {
        type: 'intersection',
        types: typePaths.map(p => processExport(p))
      });
    }

    if (path.isTSTypeParameter()) {
      return Object.assign(node, {
        type: 'typeParameter',
        name: path.node.name,
        constraint: path.node.constraint
          ? processExport(path.get('constraint') as NodePath)
          : null,
        default: path.node.default
          ? processExport(path.get('default') as NodePath)
          : null
      });
    }

    if (path.isTSTupleType()) {
      const elemPaths = path.get('elementTypes') as NodePath[];
      return Object.assign(node, {
        type: 'tuple',
        elements: elemPaths.map(t => processExport(t))
      });
    }

    if (path.isTSConditionalType()) {
      return Object.assign(node, {
        type: 'conditional',
        checkType: processExport(path.get('checkType') as NodePath),
        extendsType: processExport(path.get('extendsType') as NodePath),
        trueType: processExport(path.get('trueType') as NodePath),
        falseType: processExport(path.get('falseType') as NodePath)
      });
    }

    if (path.isTSIndexedAccessType()) {
      return Object.assign(node, {
        type: 'indexedAccess',
        objectType: processExport(path.get('objectType') as NodePath),
        indexType: processExport(path.get('indexType') as NodePath)
      });
    }

    return Object.assign(node, { type: 'any' });
  }

  function processParameter(p: NodePath): ParameterDocNode {
    let target = p;
    if (target.isAssignmentPattern()) {
      target = target.get('left') as NodePath;
    }

    const node = target.node as any;
    const isRest = target.isRestElement();
    const name = isRest ? node.argument?.name : node.name;
    const typePath = target.get('typeAnnotation.typeAnnotation') as NodePath;

    return {
      type: 'parameter',
      name: name ?? 'param',
      value: typePath ? processExport(typePath) : { type: 'any' },
      optional: Boolean(node.optional),
      rest: isRest
    };
  }

  function isReactForwardRef(path: NodePath): boolean {
    return (
      isReactCall(path, 'forwardRef') ||
      (path.isCallExpression() &&
        (path.get('callee') as NodePath).isIdentifier({ name: 'createHideableComponent' }))
    );
  }

  function isReactCall(path: NodePath, name: string, module = 'react'): boolean {
    if (!path.isCallExpression()) {
      return false;
    }

    let callee = path.node.callee;
    let calleePath = path.get('callee') as NodePath;
    if (t.isTSAsExpression(callee)) {
      callee = callee.expression;
      calleePath = calleePath.get('expression') as NodePath;
    }

    if (!t.isMemberExpression(callee)) {
      return calleePath.referencesImport(module, name);
    }

    if ((calleePath.get('object') as NodePath).referencesImport(module, 'default')) {
      return t.isIdentifier(callee.property, { name });
    }

    // Direct React.forwardRef or imported namespace
    if (t.isIdentifier(callee.object, { name: 'React' }) && t.isIdentifier(callee.property, { name })) {
      return true;
    }

    return false;
  }

  function isReactComponent(path: NodePath): boolean {
    if (path.isFunction()) {
      const fnNode = path.node as t.FunctionDeclaration;
      const returnTypeAnnotation = fnNode.returnType;
      const returnType = t.isTSTypeAnnotation(returnTypeAnnotation)
        ? (returnTypeAnnotation.typeAnnotation as t.TSType)
        : undefined;

      if (returnType && isJSXElementType(returnType)) {
        return true;
      }

      if (
        returnType &&
        t.isTSUnionType(returnType) &&
        returnType.types.some(isJSXElementType)
      ) {
        return true;
      }

      let returnsJSX = false;
      path.traverse({
        ReturnStatement(retPath: NodePath<t.ReturnStatement>) {
          const ret = retPath.node.argument;
          if (
            t.isJSXElement(ret) ||
            t.isJSXFragment(ret) ||
            isReactCall(retPath.get('argument') as NodePath, 'cloneElement') ||
            isReactCall(retPath.get('argument') as NodePath, 'createPortal', 'react-dom')
          ) {
            returnsJSX = true;
          }
        }
      });

      return returnsJSX;
    }

    return false;
  }

  function isJSXElementType(returnType: t.TSType): boolean {
    if (
      t.isTSTypeReference(returnType) &&
      t.isTSQualifiedName(returnType.typeName) &&
      t.isIdentifier(returnType.typeName.left, { name: 'JSX' }) &&
      t.isIdentifier(returnType.typeName.right, { name: 'Element' })
    ) {
      return true;
    }

    if (t.isTSTypeReference(returnType) && t.isIdentifier(returnType.typeName, { name: 'ReactNode' })) {
      return true;
    }

    return false;
  }

  function getJSDocs(path: NodePath): JSDocMetadata {
    const comments = getDocComments(path);
    if (!comments) {
      return {};
    }

    let parsed: doctrine.Annotation;
    try {
      parsed = doctrine.parse(comments, {
        unwrap: true,
        sloppy: true,
        recoverable: true
      });
    } catch {
      return {};
    }

    const result: JSDocMetadata = {
      description: parsed.description || undefined
    };

    for (const tag of parsed.tags) {
      if (tag.title === 'default') {
        result.default = tag.description || undefined;
      } else if (tag.title === 'access') {
        result.access = tag.description || undefined;
      } else if (tag.title === 'private' || tag.title === 'deprecated') {
        result.access = 'private';
      } else if (tag.title === 'protected') {
        result.access = 'protected';
      } else if (tag.title === 'public') {
        result.access = 'public';
      } else if (tag.title === 'return' || tag.title === 'returns') {
        result.return = tag.description || undefined;
      } else if (tag.title === 'param') {
        if (!result.params) {
          result.params = {};
        }
        if (tag.name) {
          result.params[tag.name] = tag.description || '';
        }
      } else if (tag.title === 'selector') {
        result.selector = tag.description || undefined;
      } else if (tag.title === 'example') {
        if (!result.examples) {
          result.examples = [];
        }
        if (tag.description) {
          result.examples.push(
            tag.description
              .split('\n')
              .map(line => line.replace(/^\s{2}/, ''))
              .join('\n')
          );
        }
      }
    }

    if (result.examples) {
      result.examples = [
        ...new Set(result.examples.map(ex => ex.trim()).filter(Boolean))
      ];
    }

    return result;
  }

  function getDocComments(path: NodePath): string | null {
    if (path.node.leadingComments) {
      return path.node.leadingComments
        .filter(isJSDocComment)
        .map(c => c.value)
        .join('\n');
    }

    if (path.parentPath?.isExportDeclaration() && path.parent.leadingComments) {
      return path.parent.leadingComments
        .filter(isJSDocComment)
        .map(c => c.value)
        .join('\n');
    }

    return null;
  }

  function isJSDocComment(comment: t.Comment): boolean {
    const asterisks = comment.value.match(/^(\*+)/);
    return comment.type === 'CommentBlock' && Boolean(asterisks && asterisks[1].length === 1);
  }

  function addDocs(value: any, docs: JSDocMetadata): any {
    if (!value) {
      return value;
    }

    if (docs.description) {
      value.description = docs.description;
    }

    if (docs.access) {
      value.access = docs.access;
    }

    if (docs.selector) {
      value.selector = docs.selector;
    }

    if (value.type === 'property' || value.type === 'method') {
      value.default = docs.default || value.default || null;
      if (value.value && value.value.type === 'function') {
        addFunctionDocs(value.value, docs);
      }
    }

    if (value.type === 'function') {
      addFunctionDocs(value, docs);
    }

    return value;
  }

  function addFunctionDocs(value: any, docs: JSDocMetadata): void {
    const params = docs.params || {};
    if (Array.isArray(value.parameters)) {
      for (const param of value.parameters) {
        param.description = params[param.name] || param.description || null;
      }
    }

    if (value.return) {
      value.return.description = docs.return || value.return.description || null;
    }

    if (docs.examples) {
      value.examples = docs.examples;
    }
  }

  return {
    filePath,
    exports,
    dependencies
  };
}
