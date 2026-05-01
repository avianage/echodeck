'use client';

import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export function SwaggerDocs() {
  return <SwaggerUI url="/api/docs/openapi.json" docExpansion="none" />;
}
