import { pool } from '../config';
import type { CompanyRole } from '../types';

type Matrix = Partial<Record<CompanyRole, Set<string>>>;

export class PermissionService {
  private matrix: Matrix = {};

  async load(): Promise<void> {
    const { rows } = await pool.query<{ role: CompanyRole; capability: string; allowed: boolean }>(
      'SELECT role, capability, allowed FROM role_permissions'
    );
    const m: Matrix = {};
    for (const r of rows) {
      if (!m[r.role]) m[r.role] = new Set();
      if (r.allowed) m[r.role]!.add(r.capability);
    }
    this.matrix = m;
  }

  async reload(): Promise<void> { await this.load(); }

  setMatrixForTest(m: Record<string, Set<string>>): void { this.matrix = m as Matrix; }

  can(role: CompanyRole, capability: string): boolean {
    if (role === 'super_admin') return true;
    return this.matrix[role]?.has(capability) ?? false;
  }

  async setAllowed(role: CompanyRole, capability: string, allowed: boolean): Promise<void> {
    if (role === 'super_admin') return;
    await pool.query(
      `INSERT INTO role_permissions (role, capability, allowed) VALUES ($1,$2,$3)
       ON CONFLICT (role, capability) DO UPDATE SET allowed = EXCLUDED.allowed`,
      [role, capability, allowed]
    );
    await this.reload();
  }
}

export const permissionService = new PermissionService();
