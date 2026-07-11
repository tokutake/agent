import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import katex from 'katex';

/* Render a TeX string to KaTeX HTML. Streaming-safe (throwOnError: false). */
function renderMath(tex: string, displayMode: boolean): React.ReactNode {
  try {
    const html = katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: 'html',
    });
    return (
      <span
        className={displayMode ? 'math-display' : 'math-inline'}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return <code>{displayMode ? `$$${tex}$$` : `$${tex}$`}</code>;
  }
}

/* Normalize \[ \] -> $$ $$ and \( \) -> $ $ so all math uses dollar delimiters. */
function normalizeMathDelimiters(text: string): string {
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => `$$${tex}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => `$${tex}$`);
}

interface MarkdownProps {
  content: string;
}

export const Markdown: React.FC<MarkdownProps> = ({ content }) => {
  if (!content) return null;

  // Split text by code blocks: ```lang\ncode\n```
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="markdown-content">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          return <CodeBlock key={index} rawCodeBlock={part} />;
        } else {
          return <TextBlock key={index} text={part} />;
        }
      })}
    </div>
  );
};

/* Code Block Component with Copy Button */
const CodeBlock: React.FC<{ rawCodeBlock: string }> = ({ rawCodeBlock }) => {
  const [copied, setCopied] = useState(false);

  // Parse language and code
  const lines = rawCodeBlock.slice(3, -3).split('\n');
  const language = lines[0]?.trim() || 'code';
  const code = lines.slice(1).join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <pre className="code-block-container">
      <div className="code-block-header">
        <span>{language}</span>
        <button onClick={handleCopy} aria-label="Copy code">
          {copied ? (
            <>
              <Check size={13} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={13} />
              Copy code
            </>
          )}
        </button>
      </div>
      <code>{code}</code>
    </pre>
  );
};

/* Text Block Component for paragraph and other formatting */
const TextBlock: React.FC<{ text: string }> = ({ text }) => {
  const normalized = normalizeMathDelimiters(text);

  // Split out display math $$...$$ and render those as standalone blocks.
  const segments = normalized.split(/(\$\$[\s\S]+?\$\$)/g);
  if (segments.length > 1) {
    return (
      <>
        {segments.map((seg, i) => {
          const m = seg.match(/^\$\$([\s\S]+?)\$\$$/);
          if (m) {
            if (!m[1].trim()) return null;
            return <div key={`dm-${i}`}>{renderMath(m[1], true)}</div>;
          }
          return seg ? <TextBlockInner key={`t-${i}`} text={seg} /> : null;
        })}
      </>
    );
  }

  return <TextBlockInner text={normalized} />;
};

/* Inner text renderer: paragraphs, lists, headers, blockquotes, tables. */
const TextBlockInner: React.FC<{ text: string }> = ({ text }) => {
  // First, check if this block contains a table
  if (text.includes('|') && text.split('\n').some(line => line.trim().startsWith('|') && line.includes('---'))) {
    return <TableBlock text={text} />;
  }

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let listType: 'ol' | 'ul' | null = null;

  const pushListIfExist = (key: number) => {
    if (currentList.length > 0) {
      if (listType === 'ul') {
        elements.push(<ul key={`list-${key}`}>{...currentList}</ul>);
      } else if (listType === 'ol') {
        elements.push(<ol key={`list-${key}`}>{...currentList}</ol>);
      }
      currentList = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for lists
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)/);

    if (ulMatch) {
      if (listType !== 'ul') {
        pushListIfExist(i);
        listType = 'ul';
      }
      currentList.push(<li key={`li-${i}`}>{renderInline(ulMatch[2])}</li>);
    } else if (olMatch) {
      if (listType !== 'ol') {
        pushListIfExist(i);
        listType = 'ol';
      }
      currentList.push(<li key={`li-${i}`}>{renderInline(olMatch[2])}</li>);
    } else {
      pushListIfExist(i);

      // Check for blockquote
      if (trimmed.startsWith('>')) {
        const quoteContent = trimmed.slice(1).trim();
        elements.push(<blockquote key={`quote-${i}`}>{renderInline(quoteContent)}</blockquote>);
      }
      // Check for headers
      else if (trimmed.startsWith('#')) {
        const headerLevel = (trimmed.match(/^#+/) || [''])[0].length;
        const headerText = trimmed.replace(/^#+\s*/, '');
        const HeaderTag = `h${Math.min(headerLevel, 6)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
        elements.push(
          React.createElement(HeaderTag, { key: `h-${i}` }, renderInline(headerText))
        );
      }
      // Normal paragraph if not empty
      else if (trimmed) {
        elements.push(<p key={`p-${i}`}>{renderInline(line)}</p>);
      }
    }
  }

  // Final list flush
  pushListIfExist(lines.length);

  return <>{elements}</>;
};

/* Table Component */
const TableBlock: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const rows: string[][] = [];
  let headerIndex = -1;
  let separatorIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('|') && lines[i].endsWith('|')) {
      const cols = lines[i].split('|').slice(1, -1).map(c => c.trim());
      if (lines[i].includes('---') && separatorIndex === -1) {
        separatorIndex = i;
        headerIndex = i - 1;
      } else {
        rows.push(cols);
      }
    }
  }

  if (headerIndex === -1 || separatorIndex === -1) {
    // If it's a malformed table, just render as normal text
    return <p>{text}</p>;
  }

  const headers = rows[headerIndex] || [];
  const bodyRows = rows.filter((_, idx) => idx !== headerIndex);

  return (
    <div style={{ overflowX: 'auto', margin: '16px 0' }}>
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={`th-${i}`}>{renderInline(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rIdx) => (
            <tr key={`tr-${rIdx}`}>
              {row.map((cell, cIdx) => (
                <td key={`td-${rIdx}-${cIdx}`}>{renderInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* Render inline bold, italic, code tags */
function renderInline(text: string): React.ReactNode[] {
  // Regexes to extract inline formatting
  // **bold**, *italic*, `code`, [text](url), $inline math$
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\)|\$[^$\n]+?\$)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      return <React.Fragment key={index}>{renderMath(part.slice(1, -1), false)}</React.Fragment>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      return (
        <a key={index} href={linkMatch[2]} target="_blank" rel="noopener noreferrer">
          {linkMatch[1]}
        </a>
      );
    }
    return part;
  });
}
