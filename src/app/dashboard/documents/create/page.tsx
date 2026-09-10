import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/modules/auth/session';
import { getSessionContext } from '@/modules/roles/rbac';
import {
  getDocumentTemplates,
  ensureDefaultSeedTemplates,
} from '@/modules/documents/templateActions';
import { getDocumentSignatories } from '@/modules/documents/assetActions';
import { CreateDocumentClient } from './CreateDocumentClient';

export default async function CreateDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/');

  await ensureDefaultSeedTemplates();
  const ctx = await getSessionContext(session.userId);

  const canCreate =
    ctx.can('DOCUMENT_CREATE') ||
    ctx.can('DOCUMENT_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.roles.includes('COORDINATOR');

  if (!canCreate) {
    redirect('/dashboard/documents');
  }

  const resolvedParams = await searchParams;
  const [templates, signatories] = await Promise.all([
    getDocumentTemplates(),
    getDocumentSignatories(),
  ]);

  const activeTemplates = templates.filter((t) => t.status === 'ACTIVE');

  return (
    <div className="max-w-7xl mx-auto">
      <CreateDocumentClient
        templates={activeTemplates.length > 0 ? activeTemplates : templates}
        signatories={signatories}
        initialTemplateId={resolvedParams.templateId}
      />
    </div>
  );
}
