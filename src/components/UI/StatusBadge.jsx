import React from 'react';
import './StatusBadge.css';

export default function StatusBadge({ value, type }) {
  // type: 'up' | 'down' | 'neutral' | 'info' | 'warning' | 'success' | 'danger'
  return (
    <span className={`status-badge badge-${type}`}>
      {value}
    </span>
  );
}
