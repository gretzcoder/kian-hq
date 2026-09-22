import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/modules/auth/session';
import { getSessionContext } from '@/modules/roles/rbac';
import {
  getDocumentTypes,
  getDocumentTemplates,
  getTemplateById,
} from '@/modules/documents/templateActions';
import { TemplateBuilder } from '@/modules/documents/components/TemplateBuilder';

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/');

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

  const resolvedParams = await params;
  const [template, documentTypes, existingTemplates] = await Promise.all([
    getTemplateById(resolvedParams.id),
    getDocumentTypes(),
    getDocumentTemplates(),
  ]);

  if (!template) {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <TemplateBuilder
        initialTemplate={template}
        documentTypes={documentTypes}
        existingTemplates={existingTemplates}
      />
    </div>
  );
}
