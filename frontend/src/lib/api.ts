import { Space, SpaceDetail, Page, PageVersion, PageAttachment } from '../types/api';

const API_BASE = 'http://localhost:8081';

function getToken(): string {
  return typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// Space API
export async function getSpaces(): Promise<Space[]> {
  return fetchApi<Space[]>('/api/spaces');
}

export async function createSpace(data: { name: string; slug: string }): Promise<Space> {
  return fetchApi<Space>('/api/spaces', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getSpaceById(id: number): Promise<SpaceDetail> {
  return fetchApi<SpaceDetail>(`/api/spaces/${id}`);
}

export async function deleteSpace(id: number): Promise<void> {
  await fetchApi<void>(`/api/spaces/${id}`, { method: 'DELETE' });
}

// Page API
export async function getPages(spaceId?: number): Promise<Page[]> {
  const url = spaceId ? `/api/pages?spaceId=${spaceId}` : '/api/pages';
  return fetchApi<Page[]>(url);
}

export async function getPage(id: number): Promise<Page> {
  return fetchApi<Page>(`/api/pages/${id}`);
}

export async function createPage(data: {
  title: string;
  spaceId: number;
  parentId?: number | null;
  content?: unknown;
  acl?: unknown;
}): Promise<Page> {
  return fetchApi<Page>('/api/pages', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePage(
  id: number,
  data: {
    title?: string;
    content?: unknown;
    parentId?: number | null;
    acl?: unknown;
  }
): Promise<Page> {
  return fetchApi<Page>(`/api/pages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deletePage(id: number): Promise<void> {
  await fetchApi<void>(`/api/pages/${id}`, { method: 'DELETE' });
}

export async function restorePage(id: number): Promise<Page> {
  return fetchApi<Page>(`/api/pages/${id}/restore`, { method: 'POST' });
}

// Page Versions API
export async function getPageVersions(pageId: number): Promise<PageVersion[]> {
  return fetchApi<PageVersion[]>(`/api/pages/${pageId}/versions`);
}

export async function rollbackPage(pageId: number, versionId: number): Promise<Page> {
  return fetchApi<Page>(`/api/pages/${pageId}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ versionId }),
  });
}

// Attachments API
export async function getAttachments(pageId: number): Promise<PageAttachment[]> {
  return fetchApi<PageAttachment[]>(`/api/pages/${pageId}/attachments`);
}

export async function addAttachment(
  pageId: number,
  file: File,
): Promise<PageAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  const token = getToken();
  const response = await fetch(`${API_BASE}/api/pages/${pageId}/attachments`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `API error: ${response.status}`);
  }
  return response.json();
}

export async function deleteAttachment(pageId: number, attachmentId: number): Promise<void> {
  await fetchApi<void>(`/api/pages/${pageId}/attachments/${attachmentId}`, { method: 'DELETE' });
}

export interface PageTreeNode extends Page {
  children: PageTreeNode[];
}

export async function getPageChildren(pageId: number): Promise<Page[]> {
  return fetchApi<Page[]>(`/api/pages/${pageId}/children`);
}

export async function getPageTree(spaceId: number): Promise<PageTreeNode[]> {
  return fetchApi<PageTreeNode[]>(`/api/pages/tree/${spaceId}`);
}

export async function movePage(pageId: number, parentId: number | null): Promise<Page> {
  return fetchApi<Page>(`/api/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ parentId }),
  });
}

// AI Build API
export async function buildAI(prompt: string): Promise<{ title: string; content: unknown }> {
  return fetchApi<{ title: string; content: unknown }>('/api/ai/build', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

// ─── Board Types ────────────────────────────────────────────────────────────────

export interface BoardResponse {
  id: string;
  name: string;
  description?: string;
  space_id?: string;
  department_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface BoardColumnResponse {
  id: string;
  board_id: string;
  name: string;
  position: number;
  wip_limit?: number;
  color?: string;
  created_at: string;
}

export interface BoardSwimlaneResponse {
  id: string;
  board_id: string;
  name: string;
  position: number;
  color?: string;
}

export interface BoardCardResponse {
  id: string;
  board_id: string;
  column_id: string;
  swimlane_id?: string;
  title: string;
  type: 'task' | 'bug' | 'story' | 'epic';
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  position: number;
  color?: string;
  cover_image?: string;
  archived_at?: string;
  start_date?: string;
  deadline?: string;
  estimate?: number;
  actual?: number;
  author_id?: string;
  assignees?: Array<{ user_id: string; full_name?: string }>;
  labels?: Array<{ id: string; name: string; color: string }>;
}

// ─── Board API ─────────────────────────────────────────────────────────────────

export async function getBoards(filters?: { spaceId?: string; departmentId?: string }): Promise<BoardResponse[]> {
  const params = new URLSearchParams();
  if (filters?.spaceId) params.set('spaceId', filters.spaceId);
  if (filters?.departmentId) params.set('departmentId', filters.departmentId);
  const qs = params.toString();
  return fetchApi<BoardResponse[]>(`/api/boards${qs ? `?${qs}` : ''}`);
}

export async function getBoard(id: string): Promise<BoardResponse & { columns: BoardColumnResponse[]; swimlanes: BoardSwimlaneResponse[]; cards: BoardCardResponse[] }> {
  return fetchApi(`/api/boards/${id}`);
}

export async function createBoard(data: { name: string; description?: string; spaceId?: string; departmentId?: string }): Promise<BoardResponse> {
  return fetchApi<BoardResponse>('/api/boards', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateBoard(id: string, data: { name?: string; description?: string }): Promise<BoardResponse> {
  return fetchApi<BoardResponse>(`/api/boards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteBoard(id: string): Promise<void> {
  await fetchApi<void>(`/api/boards/${id}`, { method: 'DELETE' });
}

// Column API
export async function createColumn(boardId: string, data: { name: string; position?: number; wipLimit?: number }): Promise<BoardColumnResponse> {
  return fetchApi<BoardColumnResponse>(`/api/boards/${boardId}/columns`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateColumn(columnId: string, data: { name?: string; position?: number; wipLimit?: number | null }): Promise<BoardColumnResponse> {
  return fetchApi<BoardColumnResponse>(`/api/columns/${columnId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteColumn(boardId: string, columnId: string): Promise<void> {
  await fetchApi<void>(`/api/boards/${boardId}/columns/${columnId}`, { method: 'DELETE' });
}

// Swimlane API
export async function createSwimlane(boardId: string, data: { name: string; position?: number }): Promise<BoardSwimlaneResponse> {
  return fetchApi<BoardSwimlaneResponse>(`/api/boards/${boardId}/swimlanes`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteSwimlane(boardId: string, swimlaneId: string): Promise<void> {
  await fetchApi<void>(`/api/boards/${boardId}/swimlanes/${swimlaneId}`, { method: 'DELETE' });
}

// Card API
export async function getBoardCards(boardId: string): Promise<BoardCardResponse[]> {
  return fetchApi<BoardCardResponse[]>(`/api/boards/${boardId}/cards`);
}

export async function getCard(id: string): Promise<BoardCardResponse> {
  return fetchApi<BoardCardResponse>(`/api/cards/${id}`);
}

export async function createCard(data: {
  boardId: string;
  columnId: string;
  title: string;
  type?: 'task' | 'bug' | 'story' | 'epic';
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  position?: number;
  swimlaneId?: string;
}): Promise<BoardCardResponse> {
  return fetchApi<BoardCardResponse>('/api/cards', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCard(id: string, data: Partial<BoardCardResponse>): Promise<BoardCardResponse> {
  return fetchApi<BoardCardResponse>(`/api/cards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCard(id: string): Promise<void> {
  await fetchApi<void>(`/api/cards/${id}`, { method: 'DELETE' });
}

export async function archiveCard(id: string): Promise<BoardCardResponse> {
  return fetchApi<BoardCardResponse>(`/api/cards/${id}/archive`, { method: 'POST' });
}

export async function restoreCard(id: string): Promise<BoardCardResponse> {
  return fetchApi<BoardCardResponse>(`/api/cards/${id}/restore`, { method: 'POST' });
}

// Card assignees
export async function addCardAssignee(cardId: string, userId: string): Promise<void> {
  await fetchApi<void>(`/api/cards/${cardId}/assignees`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function removeCardAssignee(cardId: string, userId: string): Promise<void> {
  await fetchApi<void>(`/api/cards/${cardId}/assignees/${userId}`, { method: 'DELETE' });
}

// Card labels
export async function setCardLabels(cardId: string, labelIds: string[]): Promise<void> {
  await fetchApi<void>(`/api/cards/${cardId}/labels`, {
    method: 'PUT',
    body: JSON.stringify({ labelIds }),
  });
}

// Comments
export async function getCardComments(cardId: string): Promise<unknown[]> {
  return fetchApi<unknown[]>(`/api/cards/${cardId}/comments`);
}

export async function addCardComment(cardId: string, content: string, mentions?: string[]): Promise<unknown> {
  return fetchApi<unknown>(`/api/cards/${cardId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content, mentions }),
  });
}

// ─── Card Checklists ─────────────────────────────────────────────────────────────────

export interface ChecklistItemResponse {
  id: string;
  checklist_id: string;
  text: string;
  checked: boolean;
  position: number;
  created_at: string;
}

export interface ChecklistResponse {
  id: string;
  card_id: string;
  title: string;
  position: number;
  items: ChecklistItemResponse[];
  created_at: string;
}

export async function getCardChecklists(cardId: string): Promise<ChecklistResponse[]> {
  return fetchApi<ChecklistResponse[]>(`/api/cards/${cardId}/checklists`);
}

export async function createChecklist(cardId: string, title: string): Promise<ChecklistResponse> {
  return fetchApi<ChecklistResponse>(`/api/cards/${cardId}/checklists`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function updateChecklist(checklistId: string, data: { title?: string; position?: number }): Promise<ChecklistResponse> {
  return fetchApi<ChecklistResponse>(`/api/checklists/${checklistId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteChecklist(checklistId: string): Promise<void> {
  await fetchApi<void>(`/api/checklists/${checklistId}`, { method: 'DELETE' });
}

export async function addChecklistItem(checklistId: string, text: string): Promise<ChecklistItemResponse> {
  return fetchApi<ChecklistItemResponse>(`/api/checklists/${checklistId}/items`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function updateChecklistItem(itemId: string, data: { text?: string; checked?: boolean; position?: number }): Promise<ChecklistItemResponse> {
  return fetchApi<ChecklistItemResponse>(`/api/checklist-items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteChecklistItem(itemId: string): Promise<void> {
  await fetchApi<void>(`/api/checklist-items/${itemId}`, { method: 'DELETE' });
}

// ─── Card Activity ─────────────────────────────────────────────────────────────────

export interface ActivityResponse {
  id: string;
  card_id: string;
  user_id: string;
  user_name?: string;
  action: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

export async function getCardActivity(cardId: string): Promise<ActivityResponse[]> {
  return fetchApi<ActivityResponse[]>(`/api/cards/${cardId}/activity`);
}

// ─── Card Custom Fields ─────────────────────────────────────────────────────────────

export interface CardCustomFieldValue {
  field_id: string;
  field_name: string;
  field_type: string;
  value: unknown;
}

export async function getCardCustomFields(cardId: string): Promise<CardCustomFieldValue[]> {
  return fetchApi<CardCustomFieldValue[]>(`/api/cards/${cardId}/custom-fields`);
}

// ─── Card Relations ────────────────────────────────────────────────────────────────

export interface CardRelationResponse {
  id: string;
  card_id: string;
  target_card_id: string;
  target_card_title?: string;
  relation_type: 'blocks' | 'blocked_by' | 'duplicates' | 'relates_to' | 'parent' | 'child';
}

export async function getCardRelations(cardId: string): Promise<CardRelationResponse[]> {
  return fetchApi<CardRelationResponse[]>(`/api/cards/${cardId}/relations`);
}

// ─── Card Templates ─────────────────────────────────────────────────────────────────

export interface CardTemplateResponse {
  id: string;
  board_id: string;
  name: string;
  description?: string;
  type?: string;
  title_template?: string;
  description_template?: string;
  fields?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function getBoardTemplates(boardId: string): Promise<CardTemplateResponse[]> {
  return fetchApi<CardTemplateResponse[]>(`/api/boards/${boardId}/templates`);
}

export async function createBoardTemplate(boardId: string, data: {
  name: string;
  description?: string;
  type?: string;
  titleTemplate?: string;
  descriptionTemplate?: string;
  fields?: Record<string, unknown>;
}): Promise<CardTemplateResponse> {
  return fetchApi<CardTemplateResponse>(`/api/boards/${boardId}/templates`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await fetchApi<void>(`/api/templates/${templateId}`, { method: 'DELETE' });
}

// Notification API
export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export async function getNotifications(): Promise<Notification[]> {
  return fetchApi<Notification[]>('/api/notifications');
}

export async function markNotificationRead(id: number): Promise<Notification> {
  return fetchApi<Notification>(`/api/notifications/${id}/read`, { method: 'PUT' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetchApi<void>('/api/notifications/mark-all-read', { method: 'PUT' });
}

