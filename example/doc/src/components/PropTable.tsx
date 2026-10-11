import React from 'react';

export interface PropTableProps {
  /**
   * Component doc node from docs.exports.Button.
   */
  component?: any;
  /**
   * Directly provided doc node (e.g. interface or component).
   */
  docNode?: any;
  /**
   * Standalone or combined docs payload { exports, links }.
   */
  docs?: {
    exports: Record<string, any>;
    links: Record<string, any>;
  };
  /**
   * Export name to lookup in docs.exports.
   */
  exportName?: string;
  /**
   * Map of referenced type definitions from docs.links.
   */
  links?: Record<string, any>;
}

function resolveReference(
  nodeOrLink: any,
  links: Record<string, any> = {},
  exportsMap: Record<string, any> = {}
): any {
  if (!nodeOrLink) return null;

  // 1. Direct ID lookup in links
  if (nodeOrLink.id && links[nodeOrLink.id]) {
    return links[nodeOrLink.id];
  }

  // 2. Lookup by name, local identifier, or ID suffix
  const refName =
    nodeOrLink.name ||
    nodeOrLink.local ||
    (nodeOrLink.id ? nodeOrLink.id.split(':').pop() : null);

  if (refName) {
    if (exportsMap[refName]) {
      return exportsMap[refName];
    }
    // Search links values for matching symbol name
    const foundInLinks = Object.values(links).find((n: any) => n?.name === refName);
    if (foundInLinks) {
      return foundInLinks;
    }
  }

  return nodeOrLink;
}

function formatTypeString(typeNode: any, links: Record<string, any> = {}): string {
  if (!typeNode) return 'any';
  if (typeof typeNode === 'string') return typeNode;

  if (typeNode.type === 'link') {
    const linked = resolveReference(typeNode, links);
    if (linked && linked.name) {
      if (linked.type === 'alias' && linked.value) {
        return formatTypeString(linked.value, links);
      }
      return linked.name;
    }
    return typeNode.name || typeNode.local || (typeNode.id ? typeNode.id.split(':').pop() : 'unknown');
  }

  if (typeNode.type === 'reference') {
    return typeNode.local || typeNode.imported || 'any';
  }

  if (typeNode.type === 'union') {
    if (Array.isArray(typeNode.elements)) {
      return typeNode.elements.map((elem: any) => formatTypeString(elem, links)).join(' | ');
    }
    return 'union';
  }

  if (typeNode.type === 'intersection') {
    if (Array.isArray(typeNode.types)) {
      return typeNode.types.map((t: any) => formatTypeString(t, links)).join(' & ');
    }
    return 'intersection';
  }

  if (typeNode.type === 'array') {
    return `${formatTypeString(typeNode.elementType, links)}[]`;
  }

  if (typeNode.type === 'string') {
    return typeNode.value !== undefined ? `'${typeNode.value}'` : 'string';
  }

  if (typeNode.type === 'number') {
    return typeNode.value !== undefined ? String(typeNode.value) : 'number';
  }

  if (typeNode.type === 'boolean') {
    return typeNode.value !== undefined ? String(typeNode.value) : 'boolean';
  }

  if (typeNode.type === 'function') {
    const params = Array.isArray(typeNode.parameters)
      ? typeNode.parameters
          .map((p: any) => `${p.name || 'arg'}: ${formatTypeString(p.value, links)}`)
          .join(', ')
      : '';
    const returnType = typeNode.return ? formatTypeString(typeNode.return, links) : 'void';
    return `(${params}) => ${returnType}`;
  }

  if (typeNode.name) {
    return typeNode.name;
  }

  return typeNode.type || 'any';
}

function collectProperties(
  targetNode: any,
  links: Record<string, any>,
  exportsMap: Record<string, any>,
  visited = new Set<string>()
): Record<string, any> {
  if (!targetNode) return {};

  const resolved = resolveReference(targetNode, links, exportsMap);
  if (!resolved) return {};

  if (resolved.id) {
    if (visited.has(resolved.id)) return {};
    visited.add(resolved.id);
  }

  let propsMap: Record<string, any> = {};

  // Recursively collect inherited properties from extends
  if (Array.isArray(resolved.extends)) {
    for (const parentRef of resolved.extends) {
      const parentProps = collectProperties(parentRef, links, exportsMap, visited);
      propsMap = { ...propsMap, ...parentProps };
    }
  }

  // If node is a component, resolve its props parameter
  if (resolved.type === 'component' && resolved.props) {
    const componentProps = collectProperties(resolved.props, links, exportsMap, visited);
    propsMap = { ...propsMap, ...componentProps };
  }

  // Collect direct interface properties
  if (resolved.properties && typeof resolved.properties === 'object') {
    propsMap = { ...propsMap, ...resolved.properties };
  }

  return propsMap;
}

export function PropTable(props: PropTableProps): React.JSX.Element {
  const { component, docNode, docs, exportName, links = docs?.links || {} } = props;
  const exportsMap = docs?.exports || {};

  let target = component || docNode;
  if (!target && exportName && exportsMap[exportName]) {
    target = exportsMap[exportName];
  }
  if (!target && docs) {
    const firstComponent = Object.values(exportsMap).find((node: any) => node.type === 'component');
    const firstInterface = Object.values(exportsMap).find((node: any) => node.type === 'interface');
    target = firstComponent || firstInterface || Object.values(exportsMap)[0];
  }

  const allProps = collectProperties(target, links, exportsMap);
  const propKeys = Object.keys(allProps);

  if (propKeys.length === 0) {
    return <p className="prop-desc">No properties documented.</p>;
  }

  return (
    <div className="props-table-wrapper">
      <table className="props-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {propKeys.map(propName => {
            const prop = allProps[propName];
            const isOptional = prop?.optional ?? true;
            const defaultValue = prop?.default ? String(prop.default).replace(/^['"]|['"]$/g, '') : '-';
            const description = prop?.description || '-';
            const formattedType = formatTypeString(prop?.value, links);

            return (
              <tr key={propName}>
                <td>
                  <span className="prop-name">{propName}</span>
                  {!isOptional && <span className="prop-badge-required">*</span>}
                </td>
                <td>
                  <code className="prop-type">{formattedType}</code>
                </td>
                <td>
                  <span className="prop-default">{defaultValue}</span>
                </td>
                <td>
                  <p className="prop-desc">{description}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const PropsTable = PropTable;
