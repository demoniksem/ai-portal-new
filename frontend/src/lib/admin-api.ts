// Admin API client — talks to Paperclip API at localhost:3100/api/admin/*
// Auth: uses PAPERCLIP_API_KEY (env) + PAPERCLIP_RUN_ID (env, for mutations)

interface ProcessEnv {
  NEXT_PUBLIC_PAPERCLIP_API_KEY?: string;
  NEXT_PUBLIC_PAPERCLIP_RUN_ID?: string;
  PAPERCLIP_API_KEY?: string;
  PAPERCLIP_RUN_ID?: string;
}
declare const process: { env: ProcessEnv };

const PC_API = 'http://localhost:3100';

function getApiKey(): string {
  const val = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_PAPERCLIP_API_KEY ?? '')
    : (process.env.PAPERCLIP_API_KEY ?? '');
  return val;
}

function getRunId(): string {
  const val = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_PAPERCLIP_RUN_ID ?? '')
    : (process.env.PAPERCLIP_RUN_ID ?? '');
  return val;
}

async function adminFetch<T>(
  method: string,
  path: string,
  body?: unknown,
  options: { isMutation?: boolean } = {}
): Promise<T> {
  const apiKey = getApiKey();
  const runId = getRunId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(options.isMutation && runId ? { 'X-Paperclip-Run-Id': runId } : {}),
  };
  const opts: RequestInit = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(`${PC_API}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

// ─── Stats ─────────────────────────────────────────────────────────────────────
export interface AdminStats {
  users: number;
  departments: number;
  boards: number;
  cards: number;
}

export function getStats() {
  return adminFetch<AdminStats>('GET', '/api/admin/stats');
}

// ─── Users ─────────────────────────────────────────────────────────────────────
export interface AdminUser {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  is_active: boolean;
  company_role: string;
  created_at: string;
}

export function getUsers() {
  return adminFetch<AdminUser[]>('GET', '/api/admin/users');
}

export function createUser(data: { email: string; password: string; fullName?: string; role?: string }) {
  return adminFetch<AdminUser>('POST', '/api/admin/users', data, { isMutation: true });
}

export function updateUser(userId: string, data: Record<string, unknown>) {
  return adminFetch<AdminUser>('PATCH', `/api/admin/users/${userId}`, data, { isMutation: true });
}

export function deleteUser(userId: string) {
  return adminFetch<{ message: string }>('DELETE', `/api/admin/users/${userId}`, undefined, { isMutation: true });
}

// ─── Departments ─────────────────────────────────────────────────────────────
export interface AdminDepartment {
  id: string;
  name: string;
  description?: string;
  head_user_id?: string;
  head_user_name?: string;
  member_count: number;
  created_at: string;
}

export function getDepartments() {
  return adminFetch<AdminDepartment[]>('GET', '/api/admin/departments');
}

export function createDepartment(data: { name: string; description?: string; headUserId?: string }) {
  return adminFetch<AdminDepartment>('POST', '/api/admin/departments', data, { isMutation: true });
}

export function updateDepartment(deptId: string, data: Record<string, unknown>) {
  return adminFetch<AdminDepartment>('PATCH', `/api/admin/departments/${deptId}`, data, { isMutation: true });
}

export function deleteDepartment(deptId: string) {
  return adminFetch<{ message: string }>('DELETE', `/api/admin/departments/${deptId}`, undefined, { isMutation: true });
}

export interface DeptMember {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

export function getDepartmentMembers(deptId: string) {
  return adminFetch<DeptMember[]>('GET', `/api/admin/departments/${deptId}/members`);
}

export function addDepartmentMember(deptId: string, userId: string, role?: string) {
  return adminFetch<{ message: string }>('POST', `/api/admin/departments/${deptId}/members`, { userId, role }, { isMutation: true });
}

export function removeDepartmentMember(deptId: string, userId: string) {
  return adminFetch<{ message: string }>('DELETE', `/api/admin/departments/${deptId}/members/${userId}`, undefined, { isMutation: true });
}

export function updateDepartmentMember(deptId: string, userId: string, role: string) {
  return adminFetch<DeptMember>('PATCH', `/api/admin/departments/${deptId}/members/${userId}`, { role }, { isMutation: true });
}

// ─── Roles ───────────────────────────────────────────────────────────────────
export interface RoleUser {
  id: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  company_role: string;
  department_roles: Array<{ departmentId: string; departmentName: string; role: string }>;
}

export function getRoles() {
  return adminFetch<RoleUser[]>('GET', '/api/admin/roles');
}

export function updateCompanyRole(userId: string, role: string) {
  return adminFetch<{ message: string; role: string }>('PATCH', `/api/admin/roles/${userId}/company`, { role }, { isMutation: true });
}

// ─── Brand Settings ──────────────────────────────────────────────────────────
export interface BrandSettings {
  id?: string;
  companyName?: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  createdAt?: string;
  updatedAt?: string;
}

export function getBrand() {
  return adminFetch<BrandSettings>('GET', '/api/admin/brand');
}

export function updateBrand(data: { companyName?: string; logoUrl?: string; primaryColor?: string; accentColor?: string }) {
  return adminFetch<BrandSettings>('PUT', '/api/admin/brand', data, { isMutation: true });
}

// ─── AI Config ───────────────────────────────────────────────────────────────
export interface AiConfig {
  id?: string;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  apiBaseUrl: string | null;
  enabled: boolean;
  hasApiKey: boolean;
  apiKey?: string;
  updatedAt?: string;
}

export function getAiConfig() {
  return adminFetch<AiConfig>('GET', '/api/admin/ai-config');
}

// Note: backend uses POST for create/update of AI config
export function updateAiConfig(data: {
  provider?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  apiBaseUrl?: string | null;
  enabled?: boolean;
}) {
  return adminFetch<AiConfig>('POST', '/api/admin/ai-config', data, { isMutation: true });
}

export function resetAiConfig() {
  return adminFetch<{ message: string }>('DELETE', '/api/admin/ai-config', undefined, { isMutation: true });
}
