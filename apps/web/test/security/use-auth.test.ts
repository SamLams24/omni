import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('useAuth localStorage removal', () => {
  it('should not write to localStorage', () => {
    const filePath = join(process.cwd(), 'src/utils/useAuth.js');
    const content = readFileSync(filePath, 'utf-8');
    
    // Should not have any localStorage.setItem calls for omni_user
    const setItemMatches = content.match(/localStorage\.setItem\(['"]omni_user['"]/g);
    expect(setItemMatches).toBeNull();
  });

  it('should not remove from localStorage', () => {
    const filePath = join(process.cwd(), 'src/utils/useAuth.js');
    const content = readFileSync(filePath, 'utf-8');
    
    // Should not have any localStorage.removeItem calls for omni_user
    const removeItemMatches = content.match(/localStorage\.removeItem\(['"]omni_user['"]/g);
    expect(removeItemMatches).toBeNull();
  });

  it('should use getSession from auth-client', () => {
    const filePath = join(process.cwd(), 'src/utils/useAuth.js');
    const content = readFileSync(filePath, 'utf-8');
    
    // Should use getSession from auth-client
    expect(content).toContain('getSession');
    expect(content).toContain('auth-client');
  });
});
