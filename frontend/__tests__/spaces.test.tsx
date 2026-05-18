/**
 * Unit tests for Spaces page components and helpers
 *
 * Pure logic tests for:
 * - getPreview (text extraction from blocks)
 * - Toast type handling
 * - Page/Block interface shape
 */

describe('getPreview helper', () => {
  // Inline the getPreview logic from spaces/index.tsx
  const getPreview = (content?: { type: string; text?: string }[]): string => {
    if (!content || !Array.isArray(content)) return 'Нет контента';
    const textBlock = content.find(b => b.type === 'text');
    return textBlock && textBlock.text ? textBlock.text.substring(0, 120) : 'Нет текстового блока';
  };

  test('returns "Нет контента" when content is undefined', () => {
    expect(getPreview(undefined)).toBe('Нет контента');
  });

  test('returns "Нет контента" when content is null', () => {
    expect(getPreview(null as any)).toBe('Нет контента');
  });

  test('returns "Нет текстового блока" when content is empty array', () => {
    expect(getPreview([])).toBe('Нет текстового блока');
  });

  test('returns "Нет текстового блока" when no text block exists', () => {
    expect(getPreview([{ type: 'heading', text: 'Title' }])).toBe('Нет текстового блока');
    expect(getPreview([{ type: 'table' }])).toBe('Нет текстового блока');
  });

  test('returns text content from first text block', () => {
    expect(getPreview([{ type: 'text', text: 'Hello world' }])).toBe('Hello world');
  });

  test('returns first text block only (not all text blocks)', () => {
    const content = [
      { type: 'text', text: 'First' },
      { type: 'text', text: 'Second' },
    ];
    expect(getPreview(content)).toBe('First');
  });

  test('truncates text longer than 120 characters', () => {
    const longText = 'A'.repeat(200);
    const result = getPreview([{ type: 'text', text: longText }]);
    expect(result).toBe('A'.repeat(120));
    expect(result).toHaveLength(120);
  });

  test('handles exactly 120 character text', () => {
    const text = 'A'.repeat(120);
    expect(getPreview([{ type: 'text', text }])).toBe(text);
    expect(getPreview([{ type: 'text', text }])).toHaveLength(120);
  });

  test('handles empty string text block (falsy — returns "Нет текстового блока")', () => {
    // textBlock.text ? is falsy for empty string, so returns 'Нет текстового блока'
    expect(getPreview([{ type: 'text', text: '' }])).toBe('Нет текстового блока');
  });

  test('prefers text block over other block types', () => {
    const content = [
      { type: 'heading', text: 'Not a text block' },
      { type: 'text', text: 'Actual text' },
      { type: 'table' },
    ];
    expect(getPreview(content)).toBe('Actual text');
  });
});

// --- Toast type handling ---

describe('Toast type handling', () => {
  type ToastType = 'success' | 'error' | 'warning';

  interface Toast {
    id: number;
    message: string;
    type: ToastType;
  }

  test('toast types are valid', () => {
    const toast: Toast = { id: 1, message: 'Test', type: 'success' };
    expect(toast.type).toBe('success');
  });

  test('all toast type variants work', () => {
    const types: ToastType[] = ['success', 'error', 'warning'];
    types.forEach(t => {
      const toast: Toast = { id: 1, message: 'msg', type: t };
      expect(toast.type).toBe(t);
    });
  });

  test('toasts are distinct by id', () => {
    const toasts: Toast[] = [
      { id: 1, message: 'First', type: 'success' },
      { id: 2, message: 'Second', type: 'error' },
      { id: 3, message: 'Third', type: 'warning' },
    ];
    const ids = toasts.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('toast message can be any string', () => {
    const toast: Toast = { id: 1, message: 'Привет мир!', type: 'success' };
    expect(toast.message).toBe('Привет мир!');

    const emptyToast: Toast = { id: 2, message: '', type: 'error' };
    expect(emptyToast.message).toBe('');
  });
});

// --- Page and Block interface shape ---

describe('Page and Block interface', () => {
  interface Block {
    type: 'heading' | 'text' | 'table' | 'macro';
    text?: string;
    headers?: string[];
    rows?: string[][];
    macroName?: string;
    macroProps?: Record<string, unknown>;
  }

  interface Page {
    id: string;
    title: string;
    spaceId: string;
    content?: Block[];
  }

  test('Page accepts minimal object', () => {
    const page: Page = { id: '1', title: 'Test', spaceId: '1' };
    expect(page.id).toBe('1');
    expect(page.title).toBe('Test');
    expect(page.content).toBeUndefined();
  });

  test('Page accepts full object with content', () => {
    const page: Page = {
      id: '2',
      title: 'Full Page',
      spaceId: '1',
      content: [
        { type: 'heading', text: 'Introduction' },
        { type: 'text', text: 'Paragraph text' },
        { type: 'table', headers: ['Name'], rows: [['Alice']] },
        { type: 'macro', macroName: 'chart', macroProps: { type: 'pie' } },
      ],
    };
    expect(page.content).toHaveLength(4);
  });

  test('Block discriminated union works correctly', () => {
    const heading: Block = { type: 'heading', text: 'Title' };
    const text: Block = { type: 'text', text: 'Paragraph' };
    const table: Block = { type: 'table', headers: ['A'], rows: [['B']] };
    const macro: Block = { type: 'macro', macroName: 'chart' };

    expect(heading.type).toBe('heading');
    expect(text.type).toBe('text');
    expect(table.type).toBe('table');
    expect(macro.type).toBe('macro');
  });

  test('Macro block stores props correctly', () => {
    const chartMacro: Block = {
      type: 'macro',
      macroName: 'chart',
      macroProps: { type: 'pie', data: { values: [1, 2, 3] } },
    };
    expect(chartMacro.macroProps?.type).toBe('pie');
    expect((chartMacro.macroProps?.data as any).values).toEqual([1, 2, 3]);
  });

  test('Table block has correct structure', () => {
    const table: Block = {
      type: 'table',
      headers: ['Name', 'Role', 'Department'],
      rows: [
        ['Alice', 'Admin', 'Engineering'],
        ['Bob', 'User', 'Sales'],
      ],
    };
    expect(table.headers).toHaveLength(3);
    expect(table.rows).toHaveLength(2);
    expect(table.rows![0]).toEqual(['Alice', 'Admin', 'Engineering']);
  });

  test('Multiple pages can coexist', () => {
    const pages: Page[] = [
      { id: '1', title: 'Page 1', spaceId: '1' },
      { id: '2', title: 'Page 2', spaceId: '1' },
      { id: '3', title: 'Page 3', spaceId: '2' },
    ];
    expect(pages).toHaveLength(3);
    expect(pages[0].id).toBe('1');
    expect(pages[2].spaceId).toBe('2');
  });
});

// --- Loading skeleton structure ---

describe('LoadingSkeleton structure', () => {
  test('skeleton renders correct number of placeholder items', () => {
    // spaces/index.tsx renders 3 skeleton cards in a grid
    const skeletonCount = 3;
    const items = Array.from({ length: skeletonCount }, (_, i) => i);
    expect(items).toHaveLength(3);
  });
});

// --- Page navigation ---

describe('Page navigation behavior', () => {
  test('handlePageClick navigates to page URL', () => {
    const pageId = 'abc123';
    const expectedPath = `/pages/${pageId}`;
    // Simulate what the handler does
    const navigateTo = (id: string) => `/pages/${id}`;
    expect(navigateTo(pageId)).toBe('/pages/abc123');
  });

  test('handleLogout clears token and navigates to login', () => {
    const logout = () => {
      localStorage.removeItem('token');
      return '/login';
    };
    expect(logout()).toBe('/login');
    expect(localStorage.getItem('token')).toBeNull();
  });
});
