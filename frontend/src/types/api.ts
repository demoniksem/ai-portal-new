import React from 'react';

// Core data types for AI Portal

export interface Space {
  id: number;
  name: string;
  slug: string;
  created_at?: string;
  updated_at?: string;
}

export interface SpaceDetail extends Space {
  page_count: number;
  active_page_count: number;
  recent_pages: { id: number; title: string; updated_at?: string }[];
}

export interface Page {
  id: number;
  space_id?: number;
  parent_id?: number | null;
  title: string;
  content?: PageBlock[];
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  username?: string;
  user_id?: string;
}

export interface PageVersion {
  id: number;
  page_id: number;
  title: string;
  content?: PageBlock[];
  created_at?: string;
  username?: string;
  user_id?: string;
}

export interface PageAttachment {
  id: number;
  page_id: number;
  filename: string;
  url: string;
  mime_type: string;
  size: number;
  created_at?: string;
}

export interface PageBlock {
  type: 'heading' | 'text' | 'table' | 'list' | 'code' | 'macro';
  text?: string;
  content?: string;
  code?: string;
  macroName?: string;
  macroProps?: Record<string, unknown>;
  headers?: string[];
  rows?: string[][];
  items?: string[];
}

export interface ApiError {
  error: string;
}

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

export interface AppContextValue {
  spaces: Space[];
  setSpaces: React.Dispatch<React.SetStateAction<Space[]>>;
  pages: Page[];
  setPages: React.Dispatch<React.SetStateAction<Page[]>>;
  selectedSpace: number | null;
  selectedPage: Page | null;
  sidebarSearch: string;
  setSidebarSearch: React.Dispatch<React.SetStateAction<string>>;
  editMode: boolean;
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  previewPage: Page | null;
  setPreviewPage: React.Dispatch<React.SetStateAction<Page | null>>;
  selectSpace: (id: number) => void;
  selectPage: (page: Page) => void;
  loadSpaces: () => Promise<void>;
  loadPages: () => Promise<void>;
  addToast: (message: string, type: ToastType) => void;
  showSettings: boolean;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface AIConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  hasApiKey?: boolean;
}

export interface AIModel {
  id: string;
  name: string;
}

export interface LogEntry {
  type: 'prompt' | 'response' | 'error' | 'info';
  text: string;
}

// Toast hook return type
export interface UseToastReturn {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: number) => void;
  ToastContainer: () => React.JSX.Element | null;
}

// Settings page types
export interface AIProvider {
  openrouter: AIModel[];
  openai: AIModel[];
  anthropic: AIModel[];
  local: AIModel[];
}

export interface TestResult {
  success: boolean;
  message: string;
  model?: string;
}

// Block renderer types
export interface BlockProps {
  block: PageBlock;
  index: number;
}

// AI build types
export interface AIBuildResult {
  title: string;
  content: PageBlock[];
}
