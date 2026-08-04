import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('NeonAuthWrapper localStorage removal', () => {
  it('should not write omni_user to localStorage', () => {
    const filePath = join(process.cwd(), 'src/components/NeonAuthWrapper.jsx');
    const content = readFileSync(filePath, 'utf-8');
    
    const setItemMatches = content.match(/localStorage\.setItem\(['"]omni_user['"]/g);
    expect(setItemMatches).toBeNull();
  });
});
