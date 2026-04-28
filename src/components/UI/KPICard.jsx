import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useGA4 } from '../../contexts/GA4Context';
import './KPICard.css';

export default function KPICard({ title, value, change, trend, icon: Icon, color = 'primary', tooltip, prefix = '', suffix = '', requiresGA4 = false }) {
  const { hasGA4 } = useGA4();
  const showBlur = requiresGA4 && !hasGA4;

  const isUp   = trend === 'up';
  const isDown = trend === 'down';

  const trendClass = isUp ? 'trend-up' : isDown ? 'trend-down' : 'trend-neutral';
  const TrendIcon  = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <div className={`kpi-card card animate-fadeInUp`}>
      <div className="kpi-top">
        <span className="kpi-title">{title}</span>
        {Icon && (
          <span className={`kpi-icon-wrap kpi-icon-${color}`}>
            <Icon size={16} />
          </span>
        )}
      </div>

      <div className={showBlur ? "blur-container" : ""}>
        <div className="kpi-value">{value}</div>

        <div className="kpi-bottom">
          <span className={`kpi-trend ${trendClass}`}>
            <TrendIcon size={12} />
            <span>{Number(Math.abs(change)).toFixed(1).replace('.', ',')}%</span>
          </span>
          <span className="kpi-period">vs. período anterior</span>
        </div>
      </div>

      {showBlur && (
        <div className="blur-overlay">
          Integre o GA4 para visualizar
        </div>
      )}

      {/* Glow line on active */}
      <div className={`kpi-accent-line kpi-line-${color}`} />
    </div>
  );
}
