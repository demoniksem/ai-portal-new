import type { CompanyRole } from '../types';

export interface Capability {
  key: string;        // e.g. "board.create"
  resource: string;   // e.g. "board"
  action: string;     // e.g. "create"
  label: string;      // RU label for UI
}

export const CAPABILITIES: Capability[] = [
  { key: 'space.create', resource: 'space', action: 'create', label: 'Создавать пространства' },
  { key: 'space.read',   resource: 'space', action: 'read',   label: 'Просматривать пространства' },
  { key: 'space.update', resource: 'space', action: 'update', label: 'Изменять пространства' },
  { key: 'space.delete', resource: 'space', action: 'delete', label: 'Удалять пространства' },
  { key: 'page.create',  resource: 'page',  action: 'create', label: 'Создавать страницы' },
  { key: 'page.read',    resource: 'page',  action: 'read',   label: 'Просматривать страницы' },
  { key: 'page.update',  resource: 'page',  action: 'update', label: 'Изменять страницы' },
  { key: 'page.delete',  resource: 'page',  action: 'delete', label: 'Удалять страницы' },
  { key: 'board.create', resource: 'board', action: 'create', label: 'Создавать доски' },
  { key: 'board.read',   resource: 'board', action: 'read',   label: 'Просматривать доски' },
  { key: 'board.update', resource: 'board', action: 'update', label: 'Изменять доски' },
  { key: 'board.delete', resource: 'board', action: 'delete', label: 'Удалять доски' },
  { key: 'card.create',  resource: 'card',  action: 'create', label: 'Создавать карточки' },
  { key: 'card.update',  resource: 'card',  action: 'update', label: 'Изменять карточки' },
  { key: 'card.delete',  resource: 'card',  action: 'delete', label: 'Удалять карточки' },
  { key: 'card.move',    resource: 'card',  action: 'move',   label: 'Перемещать карточки' },
  { key: 'column.manage',resource: 'column',action: 'manage', label: 'Управлять колонками' },
  { key: 'user.manage',       resource: 'admin', action: 'user.manage',       label: 'Управлять пользователями' },
  { key: 'department.manage', resource: 'admin', action: 'department.manage', label: 'Управлять отделами' },
  { key: 'role.manage',       resource: 'admin', action: 'role.manage',       label: 'Управлять правами (этой матрицей)' },
  { key: 'aiconfig.manage',   resource: 'admin', action: 'aiconfig.manage',   label: 'Настраивать ИИ' },
  { key: 'brand.manage',      resource: 'admin', action: 'brand.manage',      label: 'Настраивать брендинг' },
];

export const CAPABILITY_KEYS = new Set(CAPABILITIES.map(c => c.key));

// Default allowed capability keys per role (super_admin implicitly = all).
export const DEFAULT_MATRIX: Record<Exclude<CompanyRole, 'super_admin'>, string[]> = {
  admin: CAPABILITIES.filter(c => c.key !== 'role.manage').map(c => c.key),
  employee: [
    'space.read', 'space.create', 'space.update',
    'page.read', 'page.create', 'page.update',
    'board.read', 'board.create', 'board.update',
    'card.create', 'card.update', 'card.move', 'column.manage',
  ],
  guest: ['space.read', 'page.read', 'board.read'],
};

export const ALL_ROLES: CompanyRole[] = ['super_admin', 'admin', 'employee', 'guest'];
