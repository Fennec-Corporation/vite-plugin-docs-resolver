import React from 'react';

export interface SourceDataItem {
  type: string;
  url: string;
}

export interface HeaderInfoProps {
  packageData?: {
    name?: string;
    version?: string;
    repository?: { url?: string } | string;
  };
  componentNames?: string[];
  sourceData?: SourceDataItem[];
}

export function HeaderInfo(props: HeaderInfoProps): React.JSX.Element {
  const { packageData, componentNames = [], sourceData = [] } = props;

  return (
    <div className="header-info">
      <div className="header-info-main">
        {packageData?.name && <code className="header-info-pkg">{packageData.name}</code>}
        {packageData?.version && <span className="header-info-badge">v{packageData.version}</span>}
      </div>

      {(componentNames.length > 0 || sourceData.length > 0) && (
        <div className="header-info-links">
          {componentNames.length > 0 && (
            <span className="header-info-components">Components: {componentNames.join(', ')}</span>
          )}
          {sourceData.map((item, idx) => (
            <a
              key={idx}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="header-info-link"
            >
              {item.type} Guidelines
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
