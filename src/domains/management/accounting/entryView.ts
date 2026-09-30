import type { AccountingType } from './types';

export type EntrySortColumn = 'date' | 'amount' | 'note' | 'account' | 'category';
export type SortDir = 'asc' | 'desc';
export interface EntrySort { column: EntrySortColumn; dir: SortDir }

export type AccountValue = 'DEBIT_CARD' | 'CASH' | 'CORPORATE_ACCOUNT';
export type AccountFilterValue = AccountValue | 'NONE';

export interface EntryFilters {
  type: 'ALL' | AccountingType;
  note: string;
  accounts: AccountFilterValue[];
  categoryIds: number[];
}

export interface EntryViewRow {
  _key: string;
  id?: number;
  date: string;
  type: AccountingType;
  amount: string;
  note: string;
  account: AccountValue | null;
  categoryId: number | null;
}

export interface EntryViewContext {
  categoryNameById: ReadonlyMap<number, string>;
  /** _key -> position in the popup's `rows`. Defaults to the position in the input array. */
  insertionIndex?: ReadonlyMap<string, number>;
  /** Rows with unsaved edits stay visible whatever the filters say, so an edit never makes its own row vanish. */
  pinnedKeys?: ReadonlySet<string>;
}

/** The fields whose difference means "the user has unsaved edits". Derived fields are excluded. */
export interface DirtyRow extends EntryViewRow {
  hasImage: boolean;
  pendingImage: Blob | null;
  removeImage: boolean;
}

export const DEFAULT_SORTS: readonly EntrySort[] = [{ column: 'date', dir: 'desc' }];

export const EMPTY_FILTERS: EntryFilters = { type: 'ALL', note: '', accounts: [], categoryIds: [] };

export const DEFAULT_SORT_DIR: Record<EntrySortColumn, SortDir> = {
  date: 'desc',
  amount: 'desc',
  note: 'asc',
  account: 'asc',
  category: 'asc',
};

const ACCOUNT_SORT_LABELS: Record<AccountValue, string> = {
  DEBIT_CARD: 'Debit Card',
  CASH: 'Cash',
  CORPORATE_ACCOUNT: 'Corporate Account',
};

/** A sort key of null means "blank" and always lands last, whatever the direction. */
type SortKey = string | number | null;

function sortKey(row: EntryViewRow, column: EntrySortColumn, ctx: EntryViewContext): SortKey {
  switch (column) {
    case 'date':
      return row.date || null;
    case 'amount': {
      const n = parseFloat(row.amount);
      return Number.isNaN(n) ? null : n;
    }
    case 'note':
      return row.note.trim() === '' ? null : row.note;
    case 'account':
      return row.account === null ? null : ACCOUNT_SORT_LABELS[row.account];
    case 'category': {
      if (row.categoryId === null) return null;
      return ctx.categoryNameById.get(row.categoryId) ?? null;
    }
  }
}

function compareKeys(a: string | number, b: string | number, column: EntrySortColumn): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const x = String(a);
  const y = String(b);
  if (column === 'date') return x < y ? -1 : x > y ? 1 : 0;
  return x.localeCompare(y, undefined, { sensitivity: 'base' });
}

function matchesFilters(row: EntryViewRow, filters: EntryFilters, pinnedKeys?: ReadonlySet<string>): boolean {
  // A row nobody has saved yet must stay visible, or clicking Add would appear to do nothing.
  if (row.id === undefined) return true;
  if (pinnedKeys?.has(row._key)) return true;
  if (filters.type !== 'ALL' && row.type !== filters.type) return false;
  const needle = filters.note.trim().toLowerCase();
  if (needle !== '' && !row.note.toLowerCase().includes(needle)) return false;
  if (filters.accounts.length > 0 && !filters.accounts.includes(row.account ?? 'NONE')) return false;
  if (filters.categoryIds.length > 0 && (row.categoryId === null || !filters.categoryIds.includes(row.categoryId))) {
    return false;
  }
  return true;
}

/** View-only: returns a new array of the SAME row objects. Never feed the result to a save. */
export function applyEntryView<T extends EntryViewRow>(
  rows: readonly T[],
  filters: EntryFilters,
  sorts: readonly EntrySort[],
  ctx: EntryViewContext
): T[] {
  const position = ctx.insertionIndex ?? new Map(rows.map((r, i) => [r._key, i]));
  const at = (r: T): number => position.get(r._key) ?? 0;

  return rows.filter((r) => matchesFilters(r, filters, ctx.pinnedKeys)).sort((a, b) => {
    for (const { column, dir } of sorts) {
      const ka = sortKey(a, column, ctx);
      const kb = sortKey(b, column, ctx);
      if (ka === null && kb === null) continue;
      if (ka === null) return 1;
      if (kb === null) return -1;
      const cmp = compareKeys(ka, kb, column);
      if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
    }
    return at(b) - at(a);
  });
}

/** default direction -> reversed (same priority slot) -> removed. */
export function nextSorts(sorts: readonly EntrySort[], column: EntrySortColumn): EntrySort[] {
  const index = sorts.findIndex((s) => s.column === column);
  if (index === -1) return [...sorts, { column, dir: DEFAULT_SORT_DIR[column] }];
  if (sorts[index].dir === DEFAULT_SORT_DIR[column]) {
    return sorts.map((s, i) => (i === index ? { column, dir: s.dir === 'asc' ? 'desc' : 'asc' } : s));
  }
  return sorts.filter((_, i) => i !== index);
}

export function nextTypeFilter(t: EntryFilters['type']): EntryFilters['type'] {
  if (t === 'ALL') return 'DEBIT';
  if (t === 'DEBIT') return 'CREDIT';
  return 'ALL';
}

export function areFiltersEmpty(filters: EntryFilters): boolean {
  return (
    filters.type === 'ALL' &&
    filters.note.trim() === '' &&
    filters.accounts.length === 0 &&
    filters.categoryIds.length === 0
  );
}

export function isDefaultSort(sorts: readonly EntrySort[]): boolean {
  return sorts.length === DEFAULT_SORTS.length && sorts.every((s, i) => s.column === DEFAULT_SORTS[i].column && s.dir === DEFAULT_SORTS[i].dir);
}

export function isDefaultView(filters: EntryFilters, sorts: readonly EntrySort[]): boolean {
  return areFiltersEmpty(filters) && isDefaultSort(sorts);
}

function isRowEqual(a: DirtyRow, b: DirtyRow): boolean {
  return (
    a._key === b._key &&
    a.id === b.id &&
    a.date === b.date &&
    a.type === b.type &&
    a.amount === b.amount &&
    a.note === b.note &&
    a.account === b.account &&
    a.categoryId === b.categoryId &&
    a.hasImage === b.hasImage &&
    a.pendingImage === b.pendingImage &&
    a.removeImage === b.removeImage
  );
}

/** Field-wise, in array order; ignores runningBalance and contributorName, which are derived. */
export function areRowsEqual(a: readonly DirtyRow[], b: readonly DirtyRow[]): boolean {
  return a.length === b.length && a.every((row, i) => isRowEqual(row, b[i]));
}

/** _keys of rows that are new or differ from the saved snapshot; removed rows are simply absent. */
export function unsavedRowKeys(rows: readonly DirtyRow[], snapshot: readonly DirtyRow[]): Set<string> {
  const saved = new Map(snapshot.map((r) => [r._key, r] as const));
  const keys = new Set<string>();
  rows.forEach((row) => {
    const original = saved.get(row._key);
    if (original === undefined || !isRowEqual(row, original)) keys.add(row._key);
  });
  return keys;
}
