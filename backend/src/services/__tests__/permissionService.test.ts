import { PermissionService } from '../permissionService';

describe('PermissionService.can', () => {
  const svc = new PermissionService();
  svc.setMatrixForTest({
    admin: new Set(['board.create']),
    employee: new Set(['board.read']),
    guest: new Set(['board.read']),
  });

  it('super_admin can do anything (bypass)', () => {
    expect(svc.can('super_admin', 'board.delete')).toBe(true);
  });
  it('admin can do granted capability', () => {
    expect(svc.can('admin', 'board.create')).toBe(true);
  });
  it('employee denied capability not granted', () => {
    expect(svc.can('employee', 'board.create')).toBe(false);
  });
  it('guest can read', () => {
    expect(svc.can('guest', 'board.read')).toBe(true);
  });
});
