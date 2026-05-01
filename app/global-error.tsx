'use client';

import { RefreshCw } from 'lucide-react';

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html>
      <body style={{ backgroundColor: '#030712', margin: 0 }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontFamily: 'sans-serif',
            textAlign: 'center',
            padding: '24px',
          }}
        >
          <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '8px' }}>Critical Error</h1>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>
            EchoDeck encountered a fatal error. Please try refreshing.
          </p>
          <button
            onClick={reset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '15px',
            }}
          >
            <RefreshCw style={{ width: 16, height: 16 }} /> Refresh Page
          </button>
        </div>
      </body>
    </html>
  );
}
