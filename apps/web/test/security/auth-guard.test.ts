import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('AuthGuard localStorage removal', () => {
  it('should not use localStorage for auth check', () => {
    const filePath = join(process.cwd(), 'src/components/AuthGuard.jsx');
    const content = readFileSync(filePath, 'utf-8');
    
    // Should not use localStorage.getItem for auth purposes
    const authPatterns = content.match(/localStorage\.getItem\(['"]omni_user['"]/g);
    expect(authPatterns).toBeNull();
  });

  it('should use getSession from auth-client', () => {
    const filePath = join(process.cwd(), 'src/components/AuthGuard.jsx');
    const content = readFileSync(filePath, 'utf-8');
    
    // Should use getSession from auth-client
    expect(content).toContain('getSession');
    expect(content).toContain('auth-client');
  });
});
