import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/modules/auth/session';
import { getSessionContext } from '@/modules/roles/rbac';
import {
  getDocumentTypes,
  getDocumentTemplates,
  ensureDefaultSeedTemplates,
} from '@/modules/documents/templateActions';
import { TemplateBuilder } from '@/modules/documents/components/TemplateBuilder';

export default async function NewTemplatePage() {
  const session = await getSession();
  if (!session) redirect('/');

  await ensureDefaultSeedTemplates();
  const ctx = await getSessionContext(session.userId);

  const canManage =
    ctx.can('DOCUMENT_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.roles.includes('COORDINATOR');

  if (!canManage) {
    redirect('/dashboard/documents');
  }

  const [documentTypes, existingTemplates] = await Promise.all([
    getDocumentTypes(),
    getDocumentTemplates(),
  ]);

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <TemplateBuilder
        documentTypes={documentTypes}
        existingTemplates={existingTemplates}
      />
    </div>
  );
}
