import { NextResponse } from 'next/server';
import { createOpenApiDocument, isApiDocsEnabled } from '@/app/lib/openapi';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isApiDocsEnabled()) {
    return NextResponse.json({ message: 'API docs are disabled' }, { status: 404 });
  }

  return NextResponse.json(createOpenApiDocument());
}
