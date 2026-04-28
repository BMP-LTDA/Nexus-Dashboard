import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import './DataTable.css';

export default function DataTable({ columns, data, maxRows }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const rowsPerPage = maxRows || 10;

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = typeof a[sortKey] === 'string' ? a[sortKey].replace(/[R$\s.,%x]/g, '').replace(',', '.') : a[sortKey];
        const bv = typeof b[sortKey] === 'string' ? b[sortKey].replace(/[R$\s.,%x]/g, '').replace(',', '.') : b[sortKey];
        const diff = parseFloat(av) - parseFloat(bv) || String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? diff : -diff;
      })
    : data;

  const totalPages = Math.ceil(sorted.length / rowsPerPage);
  const paged = sorted.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return (
    <div className="data-table-wrap">
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`${col.sortable ? 'sortable' : ''} ${col.align === 'right' ? 'align-right' : ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="th-content">
                    {col.label}
                    {col.sortable && (
                      <span className="sort-icons">
                        <ChevronUp size={10} className={sortKey === col.key && sortDir === 'asc' ? 'active' : ''} />
                        <ChevronDown size={10} className={sortKey === col.key && sortDir === 'desc' ? 'active' : ''} />
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={i} className="table-row">
                {columns.map(col => (
                  <td key={col.key} className={col.align === 'right' ? 'align-right' : ''}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="table-pagination">
          <span className="pagination-info">
            {(page - 1) * rowsPerPage + 1}–{Math.min(page * rowsPerPage, sorted.length)} de {sorted.length} registros
          </span>
          <div className="pagination-controls">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="page-btn">‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="page-btn">›</button>
          </div>
        </div>
      )}
    </div>
  );
}
