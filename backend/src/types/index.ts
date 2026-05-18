// ─── Auth & RBAC types ────────────────────────────────────────────────────────

export type CompanyRole = 'super_admin' | 'admin' | 'employee' | 'guest';
export type DepartmentRole = 'department_head' | 'member';
export type ObjectRole = 'owner' | 'editor' | 'viewer';

export interface AuthenticatedUser {
  id: string;           // UUID (rbac_users.id)
  email: string;
  username: string;
  companyId: string;    // rbac_users.company_id
  companyRole: CompanyRole;
  departmentRoles: Array<{
    departmentId: string;
    role: DepartmentRole;
  }>;
  objectRoles: Array<{
    objectType: 'space' | 'board' | 'page';
    objectId: string;
    role: ObjectRole;
  }>;
}

// ─── JWT payload ──────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;       // UUID
  email: string;
  companyId: string;
  companyRole: CompanyRole;
  iat?: number;
  exp?: number;
}

// ─── RBAC check helpers ───────────────────────────────────────────────────────

export type RoleToCheck = CompanyRole | DepartmentRole | ObjectRole;

// ─── Audit log types ──────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  companyId: string;
  actorId: string | null;
  action: string;
  objectType: string | null;
  objectId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ─── Page types (unchanged) ───────────────────────────────────────────────────

export interface AuthenticatedUserLegacy {
  id: number;
  email: string;
  username: string;
}

export interface PageSpec {
  title: string;
  content: ContentBlock[];
}

export type ContentBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'list'; items: string[] }
  | { type: 'code'; code: string }
  | { type: 'macro'; macroName: string; macroProps: Record<string, unknown> };

export interface AISettings {
  provider: 'openrouter' | 'openai' | 'anthropic' | 'openclaw' | 'local';
  model: string;
  temperature: number;
  maxTokens: number;
  apiKey?: string;
}

// MeiliSearch types — mirrors meilisearch SDK for fallback client compatibility
export interface MeiliSearchIndex {
  search: (query: string, options?: unknown) => Promise<{ hits: unknown[]; estimatedTotalHits: number }>;
  addDocuments: (docs: unknown[], primaryKey?: string) => Promise<{ taskUid: number }>;
  updateDocuments: (docs: unknown[]) => Promise<{ taskUid: number }>;
  updateSearchableAttributes: (attrs: string[]) => Promise<{ taskUid: number }>;
  deleteDocument: (id: string | number) => Promise<{ taskUid: number }>;
}

export interface MeiliSearchClient {
  index: (name: string) => MeiliSearchIndex;
  createIndex: (name: string, options: { primaryKey: string }) => Promise<{ uid: string }>;
  getIndexes: () => Promise<{ results: Array<{ uid: string }> }>;
  health: () => Promise<{ status: string }>;
}

// Augment Express Request to add user + requestId on every req object
// NOTE: This runs in a .d.ts file so ambient global augmentation is required
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

export {};
