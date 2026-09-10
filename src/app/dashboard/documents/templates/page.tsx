import { redirect } from 'next/navigation';

export default function TemplatesRedirectPage() {
  redirect('/dashboard/documents?tab=templates');
}
