import React from 'react';
import { Info } from 'lucide-react';
import { useGA4 } from '../../contexts/GA4Context';
import './ChartCard.css';

export default function ChartCard({ title, subtitle, tooltip, children, action, className = '', requiresGA4 = false }) {
  const { hasGA4 } = useGA4();
  const showBlur = requiresGA4 && !hasGA4;

  return (
    <div className={`chart-card card ${className}`}>
      <div className="chart-card-header">
        <div className="chart-card-title-group">
          <div className="chart-card-title-row">
            <h3 className="chart-card-title">{title}</h3>
            {tooltip && (
              <div className="chart-tooltip-wrap" title={tooltip}>
                <Info size={13} className="chart-info-icon" />
              </div>
            )}
          </div>
          {subtitle && <p className="chart-card-subtitle">{subtitle}</p>}
        </div>
        {action && <div className="chart-card-action">{action}</div>}
      </div>
      <div className="chart-card-body" style={{ position: 'relative' }}>
        <div className={showBlur ? "blur-container" : ""} style={showBlur ? { height: '100%' } : {}}>
          {children}
        </div>
        {showBlur && (
          <div className="blur-overlay">
            Integre o GA4 para visualizar
          </div>
        )}
      </div>
    </div>
  );
}
