import React, { useState } from 'react';

export interface ExampleProps {
  code?: string;
  children: React.ReactNode;
}

export function Example({ code, children }: ExampleProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="example-container">
      <div className="example-preview">
        {children}
      </div>
      {code && (
        <div className="example-code-wrapper">
          <div className="example-code-header">
            <span className="example-code-lang">tsx</span>
            <button
              type="button"
              className="example-copy-btn"
              onClick={handleCopy}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="example-code">
            <code>{code.trim()}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
