import { useState, type ReactElement } from 'react';
import type { TreeNode } from './types';

interface DataTreeProps {
  data: TreeNode[];
  selectedKey?: string;
  expandAll?: boolean;
  isVirtual?: boolean;
  onSelect?: (key: string) => void;
}

export function DataTree({ data, selectedKey, expandAll = false, onSelect }: DataTreeProps): ReactElement {
  return (
    <ul>
      {data.map((node) => (
        <Branch key={node.id} node={node} selectedKey={selectedKey} expandAll={expandAll} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function Branch({
  node,
  selectedKey,
  expandAll,
  onSelect
}: {
  node: TreeNode;
  selectedKey?: string;
  expandAll: boolean;
  onSelect?: (key: string) => void;
}): ReactElement {
  const [expanded, setExpanded] = useState(expandAll);
  return (
    <li>
      {node.children?.length ? (
        <button
          type="button"
          aria-label={`${expanded ? '收起' : '展开'} ${node.label}`}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '▾' : '▸'}
        </button>
      ) : null}
      <button
        type="button"
        aria-current={selectedKey === node.id ? 'true' : undefined}
        onClick={() => onSelect?.(node.id)}
      >
        {node.label}
      </button>
      {expanded && node.children?.length ? (
        <ul>
          {node.children.map((child) => (
            <Branch key={child.id} node={child} selectedKey={selectedKey} expandAll={expandAll} onSelect={onSelect} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
