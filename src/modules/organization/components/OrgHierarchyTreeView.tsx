'use client';

import React from 'react';
import { OrgNodeItem } from '../orgTypes';
import { OrgNodeCard } from './OrgNodeCard';

interface OrgHierarchyTreeViewProps {
  nodes: OrgNodeItem[];
  canManage: boolean;
  onEdit: (node: OrgNodeItem) => void;
  onDelete: (id: string, name: string) => void;
  onManageMembers: (node: OrgNodeItem) => void;
  onAddChild: (parentId: string) => void;
}

const TreeNode: React.FC<{
  node: OrgNodeItem;
  canManage: boolean;
  onEdit: (node: OrgNodeItem) => void;
  onDelete: (id: string, name: string) => void;
  onManageMembers: (node: OrgNodeItem) => void;
  onAddChild: (parentId: string) => void;
  depth?: number;
}> = ({
  node,
  canManage,
  onEdit,
  onDelete,
  onManageMembers,
  onAddChild,
  depth = 0,
}) => {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Node Card */}
      <div className="relative z-10 transition-transform duration-200 hover:-translate-y-1">
        <OrgNodeCard
          node={node}
          canManage={canManage}
          onEdit={onEdit}
          onDelete={onDelete}
          onManageMembers={onManageMembers}
          onAddChild={onAddChild}
          isCompact={depth > 1}
        />
      </div>

      {/* Connecting Vertical Line */}
      {hasChildren && (
        <>
          <div className="w-0.5 h-8 bg-zinc-300 dark:bg-zinc-700 my-0" />

          {/* Children Container */}
          <div className="relative flex justify-center gap-8 pt-4">
            {/* Horizontal Branch Connector Line */}
            {node.children!.length > 1 && (
              <div
                className="absolute top-0 h-0.5 bg-zinc-300 dark:bg-zinc-700"
                style={{
                  left: '160px',
                  right: '160px',
                }}
              />
            )}

            {node.children!.map((child) => (
              <div key={child.id} className="relative flex flex-col items-center">
                {/* Branch Stem */}
                <div className="w-0.5 h-4 bg-zinc-300 dark:bg-zinc-700 -mt-4 mb-0" />
                <TreeNode
                  node={child}
                  canManage={canManage}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onManageMembers={onManageMembers}
                  onAddChild={onAddChild}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const OrgHierarchyTreeView: React.FC<OrgHierarchyTreeViewProps> = ({
  nodes,
  canManage,
  onEdit,
  onDelete,
  onManageMembers,
  onAddChild,
}) => {
  if (nodes.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
        <p className="text-4xl mb-2">🏢</p>
        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Belum ada struktur organisasi.</p>
        <p className="text-xs text-zinc-500 mt-1">Klik tombol &ldquo;Tambah Struktur Baru&rdquo; untuk memulai.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-12 pt-4 px-4">
      <div className="min-w-max flex flex-col items-center gap-12">
        {nodes.map((rootNode) => (
          <TreeNode
            key={rootNode.id}
            node={rootNode}
            canManage={canManage}
            onEdit={onEdit}
            onDelete={onDelete}
            onManageMembers={onManageMembers}
            onAddChild={onAddChild}
          />
        ))}
      </div>
    </div>
  );
};
