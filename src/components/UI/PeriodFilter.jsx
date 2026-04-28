import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { useFilter } from '../../contexts/FilterContext';
import { periodConfig } from '../../data/mockData';
import './PeriodFilter.css';

const periodOptions = Object.entries(periodConfig).map(([key, config]) => ({
  label: config.label,
  value: key
}));

export default function PeriodFilter() {
  const { period, setPeriod, customRange, setCustomRange } = useFilter();
  const [isOpen, setIsOpen] = useState(false);
  const [tempDates, setTempDates] = useState(customRange);
  const dropdownRef = useRef(null);

  const activeLabel = period === 'custom' && customRange.start && customRange.end 
    ? `${new Date(customRange.start).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })} - ${new Date(customRange.end).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })}`
    : (periodConfig[period]?.label || 'Período');

  useEffect(() => {
    const handle = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleApplyCustom = () => {
    if (tempDates.start && tempDates.end) {
      setCustomRange(tempDates);
      setPeriod('custom');
      setIsOpen(false);
    }
  };

  return (
    <div className="period-filter" ref={dropdownRef}>
      <button 
        className={`period-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Calendar size={14} />
        <span>{activeLabel}</span>
        <ChevronDown size={14} className={`chevron ${isOpen ? 'rotated' : ''}`} />
      </button>

      {isOpen && (
        <div className="period-dropdown animate-fadeInUp">
          <div className="period-options-list">
            {periodOptions.map(opt => (
              <button
                key={opt.value}
                className={`period-option ${period === opt.value ? 'selected' : ''}`}
                onClick={() => {
                  if (opt.value !== 'custom') {
                    setPeriod(opt.value);
                    setIsOpen(false);
                  } else {
                    setPeriod('custom');
                  }
                }}
              >
                {opt.label}
                {period === opt.value && <span className="period-check">✓</span>}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="custom-range-selector">
              <div className="range-inputs">
                <div className="range-field">
                  <label>Início</label>
                  <input 
                    type="date" 
                    value={tempDates.start} 
                    onChange={e => setTempDates(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="range-field">
                  <label>Fim</label>
                  <input 
                    type="date" 
                    value={tempDates.end} 
                    onChange={e => setTempDates(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
              <button className="btn-apply-range" onClick={handleApplyCustom}>
                Aplicar Intervalo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
