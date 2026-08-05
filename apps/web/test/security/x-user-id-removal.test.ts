import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('x-user-id header removal', () => {
  const srcDir = join(process.cwd(), 'src');

  it('should not contain x-user-id header in vendor/settings/page.jsx', () => {
    const filePath = join(srcDir, 'app/vendor/settings/page.jsx');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).not.toContain('x-user-id');
  });

  it('should not contain x-user-id header in vendor/products/page.jsx', () => {
    const filePath = join(srcDir, 'app/vendor/products/page.jsx');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).not.toContain('x-user-id');
  });

  it('should not contain x-user-id header in any page.jsx file', () => {
    const { execSync } = require('child_process');
    const result = execSync(`grep -r "x-user-id" ${srcDir} --include="*.jsx" --include="*.tsx" --include="*.js" --include="*.ts" || true`, { encoding: 'utf-8' });
    expect(result.trim()).toBe('');
  });
});
