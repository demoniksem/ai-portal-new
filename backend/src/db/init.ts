import { pool, meiliClient } from '../config';
import { logger } from '../config/logger';
import { MeiliSearch } from 'meilisearch';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require('bcryptjs');
import { QueryResult } from 'pg';

async function initializeDatabase(): Promise<void> {
  try {
    // Create ENUM types (ignore if already exist)
    const enumStatements = [
      `DO $$ BEGIN CREATE TYPE company_role_level AS ENUM ('super_admin', 'admin', 'employee', 'guest'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE department_role_level AS ENUM ('department_head', 'member'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE object_role_level AS ENUM ('owner', 'editor', 'viewer'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    ];
    for (const stmt of enumStatements) {
      try { await pool.query(stmt); } catch (_) { /* ignore */ }
    }

    // Cards module ENUMs
    const cardEnumStatements = [
      `DO $$ BEGIN CREATE TYPE card_type AS ENUM ('task', 'bug', 'story', 'epic'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE card_priority AS ENUM ('low', 'medium', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE relation_type AS ENUM ('blocks', 'blocked_by', 'duplicates', 'relates_to', 'parent', 'child'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    ];
    for (const stmt of cardEnumStatements) {
      try { await pool.query(stmt); } catch (_) { /* ignore */ }
    }

    // Tables (without DO blocks)
    await pool.query(`
      -- Companies
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- RBAC users (UUID-based, multi-company)
      CREATE TABLE IF NOT EXISTS rbac_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        avatar_url TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        UNIQUE(company_id, email)
      );

      -- Company-level roles
      CREATE TABLE IF NOT EXISTS company_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES rbac_users(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        role company_role_level NOT NULL DEFAULT 'employee',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, company_id)
      );

      -- Departments
      CREATE TABLE IF NOT EXISTS departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        head_user_id UUID,
        deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Department-level roles
      CREATE TABLE IF NOT EXISTS department_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES rbac_users(id) ON DELETE CASCADE,
        department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        role department_role_level NOT NULL DEFAULT 'member',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, department_id)
      );

      -- Object-level roles (space, board, page)
      CREATE TABLE IF NOT EXISTS object_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES rbac_users(id) ON DELETE CASCADE,
        object_type VARCHAR(50) NOT NULL,
        object_id UUID NOT NULL,
        role object_role_level NOT NULL DEFAULT 'viewer',
        inherited BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, object_type, object_id)
      );

      -- Audit log
      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        actor_id UUID REFERENCES rbac_users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        object_type VARCHAR(50),
        object_id UUID,
        old_value JSONB,
        new_value JSONB,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Boards
      CREATE TABLE IF NOT EXISTS boards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        space_id UUID NOT NULL,
        department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_by UUID REFERENCES rbac_users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Board memberships
      CREATE TABLE IF NOT EXISTS board_memberships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES rbac_users(id) ON DELETE CASCADE,
        role object_role_level NOT NULL DEFAULT 'viewer',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(board_id, user_id)
      );

      -- Board columns
      CREATE TABLE IF NOT EXISTS board_columns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        wip_limit INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Swimlanes
      CREATE TABLE IF NOT EXISTS swimlanes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Cards
      CREATE TABLE IF NOT EXISTS cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        column_id UUID NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
        swimlane_id UUID REFERENCES swimlanes(id) ON DELETE SET NULL,
        type card_type NOT NULL DEFAULT 'task',
        title VARCHAR(500) NOT NULL,
        description TEXT,
        priority card_priority NOT NULL DEFAULT 'medium',
        position INTEGER NOT NULL DEFAULT 0,
        author_id UUID REFERENCES rbac_users(id) ON DELETE SET NULL,
        cover_image TEXT,
        color VARCHAR(20),
        archived_at TIMESTAMP WITH TIME ZONE,
        start_date DATE,
        deadline TIMESTAMP WITH TIME ZONE,
        estimate DECIMAL(10,2),
        actual DECIMAL(10,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Card assignees
      CREATE TABLE IF NOT EXISTS card_assignees (
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES rbac_users(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (card_id, user_id)
      );

      -- Card watchers
      CREATE TABLE IF NOT EXISTS card_watchers (
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES rbac_users(id) ON DELETE CASCADE,
        watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (card_id, user_id)
      );

      -- Labels
      CREATE TABLE IF NOT EXISTS labels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(20) NOT NULL DEFAULT '#6b7280',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Card labels
      CREATE TABLE IF NOT EXISTS card_labels (
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
        PRIMARY KEY (card_id, label_id)
      );

      -- Custom field definitions
      CREATE TABLE IF NOT EXISTS custom_field_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        field_type VARCHAR(20) NOT NULL DEFAULT 'text',
        options JSONB DEFAULT '[]',
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Card custom field values
      CREATE TABLE IF NOT EXISTS card_custom_fields (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        field_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
        value JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(card_id, field_id)
      );

      -- Checklists
      CREATE TABLE IF NOT EXISTS card_checklists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL DEFAULT 'Checklist',
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Checklist items
      CREATE TABLE IF NOT EXISTS checklist_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        checklist_id UUID NOT NULL REFERENCES card_checklists(id) ON DELETE CASCADE,
        text VARCHAR(1000) NOT NULL,
        checked BOOLEAN NOT NULL DEFAULT FALSE,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Card attachments
      CREATE TABLE IF NOT EXISTS card_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        mime_type VARCHAR(100),
        size_bytes INTEGER,
        uploaded_by UUID REFERENCES rbac_users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Card comments
      CREATE TABLE IF NOT EXISTS card_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        author_id UUID REFERENCES rbac_users(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        mentions JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Comment reactions
      CREATE TABLE IF NOT EXISTS card_reactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        comment_id UUID NOT NULL REFERENCES card_comments(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES rbac_users(id) ON DELETE CASCADE,
        emoji VARCHAR(50) NOT NULL DEFAULT '👍',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(comment_id, user_id, emoji)
      );

      -- Card relations
      CREATE TABLE IF NOT EXISTS card_relations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        target_card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        relation_type relation_type NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(card_id, target_card_id, relation_type)
      );

      -- Card activity log
      CREATE TABLE IF NOT EXISTS card_activity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        actor_id UUID REFERENCES rbac_users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        field VARCHAR(100),
        old_value JSONB,
        new_value JSONB,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Card templates
      CREATE TABLE IF NOT EXISTS card_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type card_type NOT NULL DEFAULT 'task',
        title_template VARCHAR(500),
        description_template TEXT,
        fields JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Backward compat: legacy users table (serial id)
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        username VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS spaces (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS pages (
        id SERIAL PRIMARY KEY,
        space_id INT REFERENCES spaces(id),
        title VARCHAR(255) NOT NULL,
        content JSONB NOT NULL DEFAULT '{}',
        acl JSONB NOT NULL DEFAULT '{}',
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP DEFAULT NULL
      );
      CREATE TABLE IF NOT EXISTS page_versions (
        id SERIAL PRIMARY KEY,
        page_id INT NOT NULL REFERENCES pages(id),
        title VARCHAR(255) NOT NULL,
        content JSONB NOT NULL DEFAULT '{}',
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS page_attachments (
        id SERIAL PRIMARY KEY,
        page_id INT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size_bytes BIGINT NOT NULL DEFAULT 0,
        uploaded_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ai_settings (
        id SERIAL PRIMARY KEY,
        user_id INT UNIQUE REFERENCES users(id),
        provider VARCHAR(50) NOT NULL DEFAULT 'openrouter',
        api_key TEXT,
        model VARCHAR(255) NOT NULL DEFAULT 'qwen/qwen3.6-plus:free',
        temperature DECIMAL(3,2) NOT NULL DEFAULT 0.70,
        max_tokens INT NOT NULL DEFAULT 4000,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Company-level AI configuration
      CREATE TABLE IF NOT EXISTS company_ai_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        provider VARCHAR(50) NOT NULL DEFAULT 'openrouter',
        api_key TEXT,
        model VARCHAR(255) NOT NULL DEFAULT 'qwen/qwen3.6-plus:free',
        temperature DECIMAL(3,2) NOT NULL DEFAULT 0.70,
        max_tokens INT NOT NULL DEFAULT 4000,
        api_base_url VARCHAR(500),
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(company_id)
      );
    `);

    // Indexes and FK for RBAC tables (separate statements, ignore if exist)
    const idxStatements = [
      'CREATE INDEX IF NOT EXISTS idx_rbac_users_company_id ON rbac_users(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_rbac_users_email ON rbac_users(email)',
      'CREATE INDEX IF NOT EXISTS idx_company_roles_user_id ON company_roles(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_company_roles_company_id ON company_roles(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_department_roles_user_id ON department_roles(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_department_roles_department_id ON department_roles(department_id)',
      'CREATE INDEX IF NOT EXISTS idx_object_roles_user_id ON object_roles(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_object_roles_object ON object_roles(object_type, object_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_company_id ON audit_log(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_object ON audit_log(object_type, object_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_departments_company_id ON departments(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_departments_head_user_id ON departments(head_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_boards_space_id ON boards(space_id)',
      'CREATE INDEX IF NOT EXISTS idx_boards_department_id ON boards(department_id)',
      'CREATE INDEX IF NOT EXISTS idx_board_memberships_board_id ON board_memberships(board_id)',
      'CREATE INDEX IF NOT EXISTS idx_board_memberships_user_id ON board_memberships(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_board_columns_board_id ON board_columns(board_id)',
      'CREATE INDEX IF NOT EXISTS idx_board_columns_position ON board_columns(board_id, position)',
      'CREATE INDEX IF NOT EXISTS idx_swimlanes_board_id ON swimlanes(board_id)',
      'CREATE INDEX IF NOT EXISTS idx_cards_board_id ON cards(board_id)',
      'CREATE INDEX IF NOT EXISTS idx_cards_column_id ON cards(column_id)',
      'CREATE INDEX IF NOT EXISTS idx_cards_swimlane_id ON cards(swimlane_id)',
      'CREATE INDEX IF NOT EXISTS idx_cards_author_id ON cards(author_id)',
      'CREATE INDEX IF NOT EXISTS idx_cards_archived_at ON cards(archived_at)',
      'CREATE INDEX IF NOT EXISTS idx_cards_deadline ON cards(deadline)',
      'CREATE INDEX IF NOT EXISTS idx_card_assignees_user_id ON card_assignees(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_card_watchers_user_id ON card_watchers(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_labels_board_id ON labels(board_id)',
      'CREATE INDEX IF NOT EXISTS idx_card_labels_label_id ON card_labels(label_id)',
      'CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_board_id ON custom_field_definitions(board_id)',
      'CREATE INDEX IF NOT EXISTS idx_card_custom_fields_card_id ON card_custom_fields(card_id)',
      'CREATE INDEX IF NOT EXISTS idx_card_checklists_card_id ON card_checklists(card_id)',
      'CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id)',
      'CREATE INDEX IF NOT EXISTS idx_card_attachments_card_id ON card_attachments(card_id)',
      'CREATE INDEX IF NOT EXISTS idx_card_comments_card_id ON card_comments(card_id)',
      'CREATE INDEX IF NOT EXISTS idx_card_comments_author_id ON card_comments(author_id)',
      'CREATE INDEX IF NOT EXISTS idx_card_reactions_comment_id ON card_reactions(comment_id)',
      'CREATE INDEX IF NOT EXISTS idx_card_relations_card_id ON card_relations(card_id)',
      'CREATE INDEX IF NOT EXISTS idx_card_relations_target_card_id ON card_relations(target_card_id)',
      'CREATE INDEX IF NOT EXISTS idx_card_activity_log_card_id ON card_activity_log(card_id)',
      'CREATE INDEX IF NOT EXISTS idx_card_activity_log_created_at ON card_activity_log(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_card_templates_board_id ON card_templates(board_id)',
      'CREATE INDEX IF NOT EXISTS idx_company_ai_config_company_id ON company_ai_config(company_id)',
    ];
    for (const stmt of idxStatements) {
      try { await pool.query(stmt); } catch (_) { /* ignore */ }
    }

    // Partial index for active users
    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_rbac_users_deleted_at ON rbac_users(deleted_at) WHERE deleted_at IS NULL');
    } catch (_) { /* ignore */ }

    logger.info({ msg: 'DB tables initialized' });

    // Default admin
    const adminEmail = 'admin@portal.com';
    const adminPass = 'admin123';
    const existingAdmin: QueryResult = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existingAdmin.rows.length === 0) {
      const hashed = await bcrypt.hash(adminPass, 10);
      await pool.query('INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3)', [adminEmail, hashed, 'admin']);
      logger.info({ msg: 'Default admin created', email: 'admin@portal.com' });
    }

    // MeiliSearch index - only when real MeiliSearch is configured
    if (process.env.MEILISEARCH_URL) {
      try {
        // Cast through unknown since MeiliClientType = MeiliSearch | FallbackMeiliClient
        // When MEILISEARCH_URL is set, the client is always a real MeiliSearch instance
        const meili = meiliClient as unknown as MeiliSearch;
        const indexes = await meili.getIndexes();
        const indexUids = indexes.results?.map(idx => idx.uid) ?? [];

        const indexConfigs = [
          { uid: 'pages', attrs: ['title', 'content'], filterAttrs: ['spaceId'] },
          { uid: 'cards', attrs: ['title', 'description'], filterAttrs: ['board_id', 'type', 'priority'] },
        ];

        for (const cfg of indexConfigs) {
          if (!indexUids.includes(cfg.uid)) {
            await meili.createIndex(cfg.uid, { primaryKey: 'id' });
          }
          const idx = meili.index(cfg.uid);
          await idx.updateSearchableAttributes(cfg.attrs);
          await (idx as unknown as { updateFilterableAttributes(attrs: string[]): Promise<{ taskUid: number }> }).updateFilterableAttributes(cfg.filterAttrs);
          logger.info({ msg: `MeiliSearch index ${cfg.uid} created/configured` });
        }
      } catch (e) {
        logger.warn({ msg: 'MeiliSearch index setup note', error: (e as Error).message });
      }
    }
  } catch (e) {
    logger.error({ msg: 'DB init error', error: (e as Error).message });
  }
}

export { initializeDatabase };
