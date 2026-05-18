'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { languageClassPrefix: 'language-' },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'tiptap-link' },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Начните писать...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return (
      <div style={{
        minHeight: '200px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        background: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9ca3af',
      }}>
        Загрузка редактора...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        padding: '8px 12px',
        border: '1px solid #e5e7eb',
        borderBottom: 'none',
        borderRadius: '8px 8px 0 0',
        background: '#f9fafb',
      }}>
        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Жирный (Ctrl+B)"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Курсив (Ctrl+I)"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Подчёркнутый (Ctrl+U)"
        >
          <u>U</u>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Зачёркнутый"
        >
          <s>S</s>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Заголовок 1"
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Заголовок 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Заголовок 3"
        >
          H3
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Маркированный список"
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Нумерованный список"
        >
          1. List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Цитата"
        >
          &ldquo;&rdquo;
        </ToolbarButton>

        <ToolbarDivider />

        {/* Code */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Инлайн-код"
        >
          {'</>'}
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="Блок кода"
        >
          {'{ }'}
        </ToolbarButton>

        <ToolbarDivider />

        {/* Link */}
        <ToolbarButton
          onClick={() => {
            const url = window.prompt('URL:', editor.getAttributes('link').href || 'https://');
            if (url === null) return;
            if (url === '') {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
            } else {
              editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            }
          }}
          active={editor.isActive('link')}
          title="Ссылка"
        >
          🔗
        </ToolbarButton>

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Горизонтальная линия"
        >
          —
        </ToolbarButton>

        <ToolbarDivider />

        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Отменить (Ctrl+Z)"
        >
          ↩
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Повторить (Ctrl+Y)"
        >
          ↪
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '0 0 8px 8px',
          minHeight: '200px',
          background: '#fff',
        }}
      />

      <style>{`
        .tiptap-editor {
          padding: 12px 16px;
          min-height: 200px;
          outline: none;
          font-family: inherit;
          font-size: 0.95rem;
          line-height: 1.7;
          color: #374151;
        }
        .tiptap-editor p {
          margin: 0 0 0.75em 0;
        }
        .tiptap-editor h1 {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 1em 0 0.5em 0;
          color: #111827;
        }
        .tiptap-editor h2 {
          font-size: 1.35rem;
          font-weight: 600;
          margin: 0.9em 0 0.4em 0;
          color: #1f2937;
        }
        .tiptap-editor h3 {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0.8em 0 0.3em 0;
          color: #374151;
        }
        .tiptap-editor ul, .tiptap-editor ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .tiptap-editor li {
          margin: 0.25em 0;
        }
        .tiptap-editor blockquote {
          border-left: 3px solid #667eea;
          padding-left: 1em;
          margin: 0.75em 0;
          color: #6b7280;
          font-style: italic;
        }
        .tiptap-editor code {
          background: #f3f4f6;
          padding: 0.15em 0.4em;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
          font-size: 0.88em;
          color: #dc2626;
        }
        .tiptap-editor pre {
          background: #1f2937;
          color: #f9fafb;
          padding: 1em;
          border-radius: 6px;
          overflow-x: auto;
          margin: 0.75em 0;
        }
        .tiptap-editor pre code {
          background: none;
          color: inherit;
          padding: 0;
          font-size: 0.875rem;
        }
        .tiptap-editor hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 1em 0;
        }
        .tiptap-editor a, .tiptap-link {
          color: #667eea;
          text-decoration: underline;
          cursor: pointer;
        }
        .tiptap-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          float: left;
          height: 0;
        }
      `}</style>
    </div>
  );
}

// Small toolbar button component
function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: '4px 8px',
        fontSize: '0.82rem',
        fontWeight: active ? 700 : 400,
        background: active ? '#eef2ff' : 'transparent',
        color: active ? '#4338ca' : '#374151',
        border: active ? '1px solid #c7d2fe' : '1px solid transparent',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        minWidth: '28px',
        textAlign: 'center',
        transition: 'all 0.1s ease',
      }}
      onMouseEnter={e => {
        if (!disabled && !active) {
          e.currentTarget.style.background = '#f3f4f6';
        }
      }}
      onMouseLeave={e => {
        if (!disabled && !active) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return (
    <div style={{
      width: '1px',
      background: '#e5e7eb',
      margin: '0 4px',
      alignSelf: 'stretch',
    }} />
  );
}
