import React, { createContext, useContext, useState, useEffect } from 'react';
import { periodConfig, setMockDataCustomRange } from '../data/mockData';

const FilterContext = createContext();

export function FilterProvider({ children }) {
  const [period, setPeriod] = useState('30d');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  useEffect(() => {
    setMockDataCustomRange(customRange);
  }, [customRange]);

  // Baseline is 30 days = multiplier 1.0
  let multiplier = periodConfig[period]?.multiplier || 1.0;

  const [dataVersion, setDataVersion] = useState(0);

  const refreshData = () => setDataVersion(v => v + 1);

  if (period === 'custom' && customRange.start && customRange.end) {
    const start = new Date(customRange.start);
    const end = new Date(customRange.end);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    multiplier = diffDays / 30;
  }

  return (
    <FilterContext.Provider value={{ 
      period, 
      setPeriod, 
      customRange, 
      setCustomRange,
      multiplier,
      dataVersion,
      refreshData
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export const useFilter = () => useContext(FilterContext);
