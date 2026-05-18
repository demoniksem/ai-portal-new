const { z } = require('zod');

// Replicate the validation schemas from src/index.js
const schemas = {
  register: z.object({
    email: z.string().email('Invalid email format').max(255),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    username: z.string().max(100).optional(),
  }),
  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
  createSpace: z.object({
    name: z.string().min(1, 'Name is required').max(255),
    slug: z.string().min(1, 'Slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  }),
  createPage: z.object({
    title: z.string().min(1, 'Title is required').max(500),
    content: z.any().optional(),
    spaceId: z.number().int().positive('spaceId must be a positive integer'),
    acl: z.any().optional(),
  }),
  updatePage: z.object({
    title: z.string().min(1).max(500).optional(),
    content: z.any().optional(),
    acl: z.any().optional(),
  }),
  aiBuild: z.object({
    prompt: z.string().min(1, 'Prompt is required').max(5000, 'Prompt too long (max 5000 characters)'),
  }),
  createComment: z.object({
    text: z.string().min(1, 'Comment text is required').max(10000),
  }),
  createNotification: z.object({
    title: z.string().min(1).max(255),
    message: z.string().min(1).max(2000),
    userId: z.number().int().positive().optional(),
  }),
  jiraIntegration: z.object({
    jiraUrl: z.string().url('Invalid Jira URL').includes('atlassian.net', 'Jira URL must be from atlassian.net'),
    jql: z.string().min(1, 'JQL is required').max(2000),
    maxResults: z.number().int().min(1).max(100).optional(),
  }),
  aiSettings: z.object({
    provider: z.enum(['openrouter', 'openai', 'anthropic', 'local']).default('openrouter'),
    apiKey: z.string().max(500).optional(),
    model: z.string().min(1, 'Model is required').max(255),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().min(100).max(32000).default(4000),
  }),
};

describe('Zod Validation Schemas', () => {
  describe('register schema', () => {
    test('accepts valid registration data', () => {
      const valid = { email: 'test@example.com', password: 'password123' };
      expect(() => schemas.register.parse(valid)).not.toThrow();
    });

    test('accepts valid registration with username', () => {
      const valid = { email: 'test@example.com', password: 'password123', username: 'testuser' };
      expect(() => schemas.register.parse(valid)).not.toThrow();
    });

    test('rejects invalid email', () => {
      const invalid = { email: 'not-an-email', password: 'password123' };
      expect(() => schemas.register.parse(invalid)).toThrow();
    });

    test('rejects short password (less than 8 chars)', () => {
      const invalid = { email: 'test@example.com', password: 'short' };
      expect(() => schemas.register.parse(invalid)).toThrow();
    });

    test('rejects missing email', () => {
      const invalid = { password: 'password123' };
      expect(() => schemas.register.parse(invalid)).toThrow();
    });

    test('rejects missing password', () => {
      const invalid = { email: 'test@example.com' };
      expect(() => schemas.register.parse(invalid)).toThrow();
    });
  });

  describe('login schema', () => {
    test('accepts valid login data', () => {
      const valid = { email: 'test@example.com', password: 'password123' };
      expect(() => schemas.login.parse(valid)).not.toThrow();
    });

    test('rejects invalid email', () => {
      const invalid = { email: 'bad-email', password: 'password123' };
      expect(() => schemas.login.parse(invalid)).toThrow();
    });

    test('rejects empty password', () => {
      const invalid = { email: 'test@example.com', password: '' };
      expect(() => schemas.login.parse(invalid)).toThrow();
    });
  });

  describe('createSpace schema', () => {
    test('accepts valid space data', () => {
      const valid = { name: 'My Space', slug: 'my-space' };
      expect(() => schemas.createSpace.parse(valid)).not.toThrow();
    });

    test('accepts slug with numbers', () => {
      const valid = { name: 'Space 123', slug: 'space-123' };
      expect(() => schemas.createSpace.parse(valid)).not.toThrow();
    });

    test('rejects uppercase in slug', () => {
      const invalid = { name: 'My Space', slug: 'My-Space' };
      expect(() => schemas.createSpace.parse(invalid)).toThrow();
    });

    test('rejects slug with spaces', () => {
      const invalid = { name: 'My Space', slug: 'my space' };
      expect(() => schemas.createSpace.parse(invalid)).toThrow();
    });

    test('rejects empty name', () => {
      const invalid = { name: '', slug: 'my-space' };
      expect(() => schemas.createSpace.parse(invalid)).toThrow();
    });

    test('rejects slug with special characters', () => {
      const invalid = { name: 'Space', slug: 'my_space!' };
      expect(() => schemas.createSpace.parse(invalid)).toThrow();
    });
  });

  describe('createPage schema', () => {
    test('accepts valid page data', () => {
      const valid = { title: 'My Page', spaceId: 1 };
      expect(() => schemas.createPage.parse(valid)).not.toThrow();
    });

    test('accepts page with content and acl', () => {
      const valid = { title: 'My Page', spaceId: 1, content: { text: 'Hello' }, acl: { read: 'all' } };
      expect(() => schemas.createPage.parse(valid)).not.toThrow();
    });

    test('rejects non-positive spaceId', () => {
      const invalid = { title: 'My Page', spaceId: 0 };
      expect(() => schemas.createPage.parse(invalid)).toThrow();
    });

    test('rejects negative spaceId', () => {
      const invalid = { title: 'My Page', spaceId: -1 };
      expect(() => schemas.createPage.parse(invalid)).toThrow();
    });

    test('rejects missing title', () => {
      const invalid = { spaceId: 1 };
      expect(() => schemas.createPage.parse(invalid)).toThrow();
    });
  });

  describe('updatePage schema', () => {
    test('accepts partial update with title only', () => {
      const valid = { title: 'New Title' };
      expect(() => schemas.updatePage.parse(valid)).not.toThrow();
    });

    test('accepts empty object (no updates)', () => {
      const valid = {};
      expect(() => schemas.updatePage.parse(valid)).not.toThrow();
    });
  });

  describe('aiBuild schema', () => {
    test('accepts valid prompt', () => {
      const valid = { prompt: 'Build a page about AI agents' };
      expect(() => schemas.aiBuild.parse(valid)).not.toThrow();
    });

    test('rejects empty prompt', () => {
      const invalid = { prompt: '' };
      expect(() => schemas.aiBuild.parse(invalid)).toThrow();
    });

    test('rejects prompt exceeding 5000 chars', () => {
      const invalid = { prompt: 'a'.repeat(5001) };
      expect(() => schemas.aiBuild.parse(invalid)).toThrow();
    });
  });

  describe('createComment schema', () => {
    test('accepts valid comment', () => {
      const valid = { text: 'This is a comment' };
      expect(() => schemas.createComment.parse(valid)).not.toThrow();
    });

    test('rejects empty text', () => {
      const invalid = { text: '' };
      expect(() => schemas.createComment.parse(invalid)).toThrow();
    });
  });

  describe('createNotification schema', () => {
    test('accepts valid notification', () => {
      const valid = { title: 'Hello', message: 'World' };
      expect(() => schemas.createNotification.parse(valid)).not.toThrow();
    });

    test('accepts notification with userId', () => {
      const valid = { title: 'Hello', message: 'World', userId: 1 };
      expect(() => schemas.createNotification.parse(valid)).not.toThrow();
    });

    test('rejects empty title', () => {
      const invalid = { title: '', message: 'World' };
      expect(() => schemas.createNotification.parse(invalid)).toThrow();
    });
  });

  describe('jiraIntegration schema', () => {
    test('accepts valid Jira URL', () => {
      const valid = { jiraUrl: 'https://company.atlassian.net', jql: 'project = PROJ' };
      expect(() => schemas.jiraIntegration.parse(valid)).not.toThrow();
    });

    test('accepts Jira URL with maxResults', () => {
      const valid = { jiraUrl: 'https://company.atlassian.net', jql: 'project = PROJ', maxResults: 50 };
      expect(() => schemas.jiraIntegration.parse(valid)).not.toThrow();
    });

    test('rejects non-atlassian URL', () => {
      const invalid = { jiraUrl: 'https://jira.example.com', jql: 'project = PROJ' };
      expect(() => schemas.jiraIntegration.parse(invalid)).toThrow();
    });

    test('rejects invalid URL', () => {
      const invalid = { jiraUrl: 'not-a-url', jql: 'project = PROJ' };
      expect(() => schemas.jiraIntegration.parse(invalid)).toThrow();
    });
  });

  describe('aiSettings schema', () => {
    test('accepts valid settings with openrouter', () => {
      const valid = { provider: 'openrouter', model: 'qwen/qwen3.6-plus:free', temperature: 0.7, maxTokens: 4000 };
      expect(() => schemas.aiSettings.parse(valid)).not.toThrow();
    });

    test('accepts openai provider', () => {
      const valid = { provider: 'openai', model: 'gpt-4o', temperature: 0.5, maxTokens: 8000 };
      expect(() => schemas.aiSettings.parse(valid)).not.toThrow();
    });

    test('accepts anthropic provider', () => {
      const valid = { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' };
      expect(() => schemas.aiSettings.parse(valid)).not.toThrow();
    });

    test('rejects invalid provider', () => {
      const invalid = { provider: 'unknown', model: 'some-model' };
      expect(() => schemas.aiSettings.parse(invalid)).toThrow();
    });

    test('rejects temperature out of range (negative)', () => {
      const invalid = { provider: 'openrouter', model: 'qwen/qwen3.6-plus:free', temperature: -0.1 };
      expect(() => schemas.aiSettings.parse(invalid)).toThrow();
    });

    test('rejects temperature out of range (>2)', () => {
      const invalid = { provider: 'openrouter', model: 'qwen/qwen3.6-plus:free', temperature: 2.5 };
      expect(() => schemas.aiSettings.parse(invalid)).toThrow();
    });

    test('rejects maxTokens below 100', () => {
      const invalid = { provider: 'openrouter', model: 'qwen/qwen3.6-plus:free', maxTokens: 50 };
      expect(() => schemas.aiSettings.parse(invalid)).toThrow();
    });
  });
});
