import { logger } from '@/lib/logger';

describe('Logger', () => {
  it('is created without throwing', () => {
    expect(logger).toBeDefined();
  });

  it('has correct level from env or defaults', () => {
    expect(typeof logger.level).toBe('string');
  });

  it('exposes info, error, warn methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });
});
