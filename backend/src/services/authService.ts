import { hash, compare } from 'bcryptjs';
import { sign, verify, SignOptions } from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRY } from '../config';
import { RbacUsersRepository, RbacUsersRepository as UsersRepo } from '../repositories/users';
import { AuditService } from './auditService';
import type { AuthenticatedUser, JwtPayload } from '../types';

const usersRepo = new UsersRepo();
const auditService = new AuditService();

interface AuthResult {
  token?: string;
  user?: AuthenticatedUser;
  error?: string;
  status?: number;
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────

function buildToken(userId: string, email: string, companyId: string, companyRole: string): string {
  const opts: SignOptions = { expiresIn: JWT_EXPIRY as SignOptions['expiresIn'] };
  return sign({ userId, email, companyId, companyRole }, JWT_SECRET, opts);
}

function verifyToken(token: string): JwtPayload | null {
  try {
    return verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// ─── AuthService ─────────────────────────────────────────────────────────────

class AuthService {
  /**
   * Register a new user in a company.
   * Default role: 'employee'.
   */
  async register(data: {
    email: string;
    password: string;
    companyId: string;
    fullName?: string;
    username?: string;
  }): Promise<AuthResult> {
    const existing = await usersRepo.findByEmail(data.email, data.companyId);
    if (existing) {
      return { error: 'User already exists', status: 409 };
    }

    const passwordHash = await hash(data.password, 12);
    const user = await usersRepo.create({
      email: data.email,
      passwordHash,
      companyId: data.companyId,
      fullName: data.fullName,
      username: data.username,
    });

    // Build token for immediate login
    const token = buildToken(user.id, user.email, user.company_id, 'employee');

    await auditService.logUserRegister(user.company_id, user.id, { id: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username ?? user.email.split('@')[0],
        companyId: user.company_id,
        companyRole: 'employee',
        departmentRoles: [],
        objectRoles: [],
      },
    };
  }

  /**
   * Authenticate with email + password.
   * Returns JWT in httpOnly cookie-style token (for API: just the token string).
   */
  async login(data: { email: string; password: string; companyId: string }): Promise<AuthResult> {
    const user = await usersRepo.findByEmail(data.email, data.companyId);
    if (!user) {
      return { error: 'Invalid credentials', status: 401 };
    }

    const isValid = await compare(data.password, user.password_hash);
    if (!isValid) {
      return { error: 'Invalid credentials', status: 401 };
    }

    // Get full profile for roles
    const profile = await usersRepo.getFullProfile(user.id);
    const token = buildToken(user.id, user.email, user.company_id, profile?.companyRole ?? 'guest');

    await auditService.logUserLogin(user.company_id, user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username ?? user.email.split('@')[0],
        companyId: user.company_id,
        companyRole: profile?.companyRole ?? 'guest',
        departmentRoles: (profile?.departmentRoles ?? []).map(r => ({
          departmentId: r.department_id,
          role: r.role,
        })),
        objectRoles: (profile?.objectRoles ?? []).map(r => ({
          objectType: r.object_type,
          objectId: r.object_id,
          role: r.role,
        })),
      },
    };
  }

  /**
   * Return the currently authenticated user profile from a JWT.
   */
  async me(token: string): Promise<AuthenticatedUser | null> {
    const payload = verifyToken(token);
    if (!payload) return null;

    const profile = await usersRepo.getFullProfile(payload.userId);
    if (!profile) return null;

    return {
      id: profile.id,
      email: profile.email,
      username: profile.fullName ?? profile.username ?? profile.email.split('@')[0],
      companyId: profile.companyId,
      companyRole: profile.companyRole,
      departmentRoles: profile.departmentRoles.map(r => ({
        departmentId: r.department_id,
        role: r.role,
      })),
      objectRoles: profile.objectRoles.map(r => ({
        objectType: r.object_type,
        objectId: r.object_id,
        role: r.role,
      })),
    };
  }

  /**
   * Verify and decode a JWT token, returning the full authenticated user.
   */
  async verifyToken(token: string): Promise<AuthenticatedUser | null> {
    return this.me(token);
  }

  /**
   * Decode token without DB call (for middleware speed).
   * Use this when you only need the JWT payload, not full profile.
   */
  decodeToken(token: string): JwtPayload | null {
    return verifyToken(token);
  }
}

export { AuthService };
export { buildToken, verifyToken };
