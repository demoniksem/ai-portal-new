/**
 * Pure block-operation utilities extracted from pages/[id].tsx
 * for independent unit testing without React rendering.
 *
 * All functions mirror the logic in EditableBlock and PageView.
 */

/** @see Block type definition in pages/[id].tsx */
export type BlockType = 'heading' | 'text' | 'table' | 'macro';

/**
 * @see Block interface in pages/[id].tsx
 * Represents a single content block on a page.
 */
export interface Block {
  type: BlockType;
  text?: string;
  headers?: string[];
  rows?: string[][];
  macroName?: string;
  macroProps?: Record<string, unknown>;
}

/**
 * Mirrors the type-change logic inside EditableBlock.handleTypeChange().
 * Given the current block state and a new type, returns the updated block
 * with sensible defaults for the new type while preserving applicable fields.
 */
export function changeBlockType(block: Block, newType: string): Block {
  const updated: Block = { type: newType as BlockType };
  if (newType === 'heading' || newType === 'text') {
    updated.text = block.text ?? '';
  } else if (newType === 'table') {
    updated.headers = block.headers ?? ['Column 1', 'Column 2'];
    updated.rows = block.rows ?? [['', '']];
  } else if (newType === 'macro') {
    updated.macroName = block.macroName ?? 'chart';
    updated.macroProps = block.macroProps ?? {};
  }
  return updated;
}

/**
 * Mirrors EditableBlock.handleTableHeaderChange().
 * Updates a column header and propagates the value to all cells in that column.
 */
export function changeTableHeader(
  headers: string[],
  rows: string[][],
  colIndex: number,
  value: string
): { headers: string[]; rows: string[][] } {
  const newHeaders = [...headers];
  newHeaders[colIndex] = value;
  const newRows = rows.map(row => {
    const newRow = [...row];
    newRow[colIndex] = value;
    return newRow;
  });
  return { headers: newHeaders, rows: newRows };
}

/**
 * Mirrors the move logic in PageView handleBlockMoveUp / handleBlockMoveDown.
 * Returns a new array with the block at `fromIndex` swapped with its neighbour.
 */
export function moveBlock(
  blocks: Block[],
  fromIndex: number,
  direction: 'up' | 'down'
): Block[] {
  if (direction === 'up') {
    if (fromIndex === 0) return blocks;
    const next = [...blocks];
    [next[fromIndex - 1], next[fromIndex]] = [next[fromIndex], next[fromIndex - 1]];
    return next;
  } else {
    if (fromIndex === blocks.length - 1) return blocks;
    const next = [...blocks];
    [next[fromIndex], next[fromIndex + 1]] = [next[fromIndex + 1], next[fromIndex]];
    return next;
  }
}

/**
 * Mirrors PageView handleBlockDelete.
 */
export function deleteBlock(blocks: Block[], index: number): Block[] {
  return blocks.filter((_, i) => i !== index);
}

/**
 * Mirrors PageView handleAddBlock.
 * Creates a new block with type-appropriate defaults and inserts it at `atIndex`
 * (defaults to append).
 */
export function addBlock(blocks: Block[], type: BlockType, atIndex?: number): Block[] {
  const newBlock: Block = { type };
  if (type === 'text' || type === 'heading') {
    newBlock.text = '';
  } else if (type === 'table') {
    newBlock.headers = ['Column 1', 'Column 2'];
    newBlock.rows = [['', '']];
  } else if (type === 'macro') {
    newBlock.macroName = 'chart';
    newBlock.macroProps = {};
  }
  const idx = atIndex ?? blocks.length;
  const next = [...blocks];
  next.splice(idx, 0, newBlock);
  return next;
}

/**
 * Mirrors EditableBlock.addTableRow().
 */
export function addTableRow(headers: string[], rows: string[][], atIndex?: number): string[][] {
  const newRow: string[] = [];
  for (let i = 0; i < headers.length; i++) newRow.push('');
  const idx = atIndex ?? rows.length;
  const next = [...rows];
  next.splice(idx, 0, newRow);
  return next;
}

/**
 * Mirrors EditableBlock.addTableCol().
 */
export function addTableCol(
  headers: string[],
  rows: string[][],
  headerName?: string
): { headers: string[]; rows: string[][] } {
  const newHeaders = [...headers, headerName ?? `Column ${headers.length + 1}`];
  const newRows = rows.map(row => [...row, '']);
  return { headers: newHeaders, rows: newRows };
}

/**
 * Mirrors EditableBlock.deleteTableRow().
 */
export function delTableRow(rows: string[][], index: number): string[][] {
  return rows.filter((_, i) => i !== index);
}

/**
 * Mirrors EditableBlock.deleteTableCol().
 */
export function delTableCol(
  headers: string[],
  rows: string[][],
  colIndex: number
): { headers: string[]; rows: string[][] } {
  const newHeaders = headers.filter((_, i) => i !== colIndex);
  const newRows = rows.map(row => row.filter((_, i) => i !== colIndex));
  return { headers: newHeaders, rows: newRows };
}

/**
 * Valid block types used for type validation.
 */
export const VALID_BLOCK_TYPES: BlockType[] = ['text', 'heading', 'table', 'macro'];
