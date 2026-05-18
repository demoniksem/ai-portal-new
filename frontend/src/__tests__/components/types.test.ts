import type { Space, Page, PageBlock, AppContextValue, AIConfig, AIModel } from '../../types/api';

describe('Space type', () => {
  it('accepts a valid Space object', () => {
    const space: Space = {
      id: 1,
      name: 'Test Space',
      slug: 'test-space',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
    };
    expect(space.id).toBe(1);
    expect(space.name).toBe('Test Space');
    expect(space.slug).toBe('test-space');
  });

  it('requires only id, name, and slug at minimum', () => {
    const space: Space = { id: 1, name: 'Min', slug: 'min' };
    expect(space.id).toBe(1);
  });
});

describe('PageBlock type', () => {
  it('accepts a heading block', () => {
    const block: PageBlock = { type: 'heading', text: 'Hello' };
    expect(block.type).toBe('heading');
    expect(block.text).toBe('Hello');
  });

  it('accepts a text block', () => {
    const block: PageBlock = { type: 'text', text: 'Paragraph content' };
    expect(block.type).toBe('text');
  });

  it('accepts a table block with headers and rows', () => {
    const block: PageBlock = {
      type: 'table',
      headers: ['Name', 'Role'],
      rows: [['Alice', 'Admin'], ['Bob', 'User']],
    };
    expect(block.type).toBe('table');
    expect(block.headers).toHaveLength(2);
    expect(block.rows).toHaveLength(2);
  });

  it('accepts a list block', () => {
    const block: PageBlock = { type: 'list', items: ['Item 1', 'Item 2', 'Item 3'] };
    expect(block.type).toBe('list');
    expect(block.items).toHaveLength(3);
  });

  it('accepts a code block', () => {
    const block: PageBlock = { type: 'code', code: 'const x = 42;' };
    expect(block.type).toBe('code');
    expect(block.code).toBe('const x = 42;');
  });

  it('accepts a macro block', () => {
    const block: PageBlock = {
      type: 'macro',
      macroName: 'info',
      macroProps: { title: 'Note', children: 'Some text' },
    };
    expect(block.type).toBe('macro');
    expect(block.macroName).toBe('info');
    expect(block.macroProps?.title).toBe('Note');
  });
});

describe('Page type', () => {
  it('accepts a full page object', () => {
    const page: Page = {
      id: 10,
      space_id: 1,
      title: 'Test Page',
      content: [
        { type: 'heading', text: 'Introduction' },
        { type: 'text', text: 'Welcome to the page.' },
      ],
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
      username: 'admin',
      user_id: 'user-123',
    };
    expect(page.id).toBe(10);
    expect(page.content).toHaveLength(2);
  });

  it('allows content to be undefined', () => {
    const page: Page = { id: 1, title: 'Empty Page' };
    expect(page.content).toBeUndefined();
  });
});

describe('AIConfig type', () => {
  it('accepts a valid AIConfig object', () => {
    const config: AIConfig = {
      provider: 'openrouter',
      model: 'anthropic/claude-3-haiku',
      temperature: 0.7,
      maxTokens: 2048,
      hasApiKey: true,
    };
    expect(config.provider).toBe('openrouter');
    expect(config.hasApiKey).toBe(true);
  });

  it('allows hasApiKey to be undefined', () => {
    const config: AIConfig = {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.5,
      maxTokens: 1024,
    };
    expect(config.hasApiKey).toBeUndefined();
  });
});

describe('AIModel type', () => {
  it('accepts a valid AIModel', () => {
    const model: AIModel = { id: 'claude-3-haiku', name: 'Claude 3 Haiku' };
    expect(model.id).toBe('claude-3-haiku');
    expect(model.name).toBe('Claude 3 Haiku');
  });
});
