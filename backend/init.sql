CREATE TABLE IF NOT EXISTS spaces (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  slug VARCHAR(255),
  created_by INT
);
CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  space_id INT REFERENCES spaces(id),
  parent_id INT REFERENCES pages(id),
  title VARCHAR(255),
  content JSONB NOT NULL,
  acl JSONB NOT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NULL,
  deleted_at TIMESTAMP DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS page_versions (
  id SERIAL PRIMARY KEY,
  page_id INT REFERENCES pages(id),
  title VARCHAR(255),
  content JSONB NOT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS page_attachments (
  id SERIAL PRIMARY KEY,
  page_id INT REFERENCES pages(id),
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),
  uploaded_by INT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_settings (
  user_id INT PRIMARY KEY,
  provider VARCHAR(50) DEFAULT 'openrouter',
  api_key TEXT,
  model VARCHAR(200) DEFAULT 'qwen/qwen3.6-plus:free',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INT DEFAULT 4000,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
