import { requirePermission } from '../rbac';
import { permissionService } from '../../services/permissionService';

function mockRes() {
  const res: any = { statusCode: 0, body: null };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  return res;
}

describe('requirePermission', () => {
  beforeAll(() => {
    permissionService.setMatrixForTest({ employee: new Set(['board.read']) } as any);
  });
  it('401 when unauthenticated', () => {
    const res = mockRes(); let nexted = false;
    requirePermission('board.read')({} as any, res, () => { nexted = true; });
    expect(res.statusCode).toBe(401); expect(nexted).toBe(false);
  });
  it('allows when role has capability', () => {
    const res = mockRes(); let nexted = false;
    const req: any = { user: { id: 'u', companyId: 'c', companyRole: 'employee' } };
    requirePermission('board.read')(req, res, () => { nexted = true; });
    expect(nexted).toBe(true);
  });
  it('403 when role lacks capability', () => {
    const res = mockRes(); let nexted = false;
    const req: any = { user: { id: 'u', companyId: 'c', companyRole: 'employee' } };
    requirePermission('board.delete')(req, res, () => { nexted = true; });
    expect(res.statusCode).toBe(403); expect(nexted).toBe(false);
  });
});
