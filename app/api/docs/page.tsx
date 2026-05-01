import { notFound } from 'next/navigation';
import { isApiDocsEnabled } from '@/app/lib/openapi';
import { SwaggerDocs } from './SwaggerDocs';

export const dynamic = 'force-dynamic';

export default function ApiDocsPage() {
  if (!isApiDocsEnabled()) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <SwaggerDocs />
    </main>
  );
}
