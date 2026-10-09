import { useMemo, useState } from 'react';
import Icon from './Icon';
import EmptyState from './EmptyState';
import { PanelSkeleton } from './Skeleton';

// Production-grade data table: client-side sort, search and pagination.
// Dense tables degrade to horizontally-scrollable tables on mobile (a
// card/row conversion is applied per-page where necessary).
export default function DataTable({
  columns = [],
  data = [],
  keyField = 'id',
  loading,
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'No records match the current filters.',
  searchPlaceholder,
  searchValue,
  onSearchChange,
  pageSize = 10,
  toolbar,
  footer,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let rows = data;
    if (searchValue) {
      const q = searchValue.toLowerCase();
      rows = rows.filter((row) =>
        columns.some((c) => {
          const v = row[c.key];
          return v !== undefined && v !== null && String(v).toLowerCase().includes(q);
        })
      );
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const va = a[sortKey];
        const vb = b[sortKey];
        if (va == null) return 1;
        if (vb == null) return -1;
        const cmp =
          typeof va === 'number' && typeof vb === 'number'
            ? va - vb
            : String(va).localeCompare(String(vb));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [data, columns, searchValue, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  return (
    <div className="data-table">
      {(toolbar || searchPlaceholder) && (
        <div className="data-table-toolbar">
          {toolbar}
          {searchPlaceholder && (
            <div className="table-search">
              <Icon name="search" size={16} />
              <input
                type="search"
                placeholder={searchPlaceholder}
                value={searchValue || ''}
                onChange={(e) => {
                  onSearchChange?.(e.target.value);
                  setPage(1);
                }}
                aria-label="Search records"
              />
            </div>
          )}
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table-inner">
          <thead>
            <tr>
              {columns.map((c, i) => {
                const sortable = c.sortable;
                const active = sortKey === c.key;
                return (
                  <th
                    key={c.key || i}
                    className={c.align ? `th-align-${c.align}` : ''}
                    style={c.width ? { width: c.width } : undefined}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        className="th-sort"
                        onClick={() => toggleSort(c.key)}
                        aria-label={`Sort by ${c.label}`}
                      >
                        {c.label}
                        <span className={`th-sort-arrow ${active ? 'active' : ''} ${sortDir === 'asc' && active ? 'asc' : ''}`}>
                          <Icon name={sortDir === 'asc' && active ? 'chevronLeft' : 'chevronRight'} size={12} />
                        </span>
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length}>
                  <div style={{ padding: '1rem' }}>
                    <PanelSkeleton rows={2} lines={1} />
                  </div>
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              paged.map((row, rowIndex) => (
                <tr key={row[keyField] ?? `row-${rowIndex}`}>
                  {columns.map((c, i) => (
                    <td
                      key={c.key || i}
                      className={c.align ? `td-align-${c.align}` : ''}
                      title={typeof row[c.key] === 'string' ? row[c.key] : undefined}
                    >
                      {c.render ? c.render(row, row[c.key]) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && filtered.length > pageSize && (
        <div className="data-table-footer">
          <span className="table-count">
            {filtered.length} results
          </span>
          <div className="table-pagination">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            <span className="table-page">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
          {footer}
        </div>
      )}
    </div>
  );
}