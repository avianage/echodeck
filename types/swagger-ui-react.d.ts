declare module 'swagger-ui-react' {
  import type { ComponentType } from 'react';

  type SwaggerUIProps = {
    url?: string;
    spec?: unknown;
    docExpansion?: 'list' | 'full' | 'none';
  };

  const SwaggerUI: ComponentType<SwaggerUIProps>;
  export default SwaggerUI;
}

declare module 'swagger-ui-react/swagger-ui.css';
