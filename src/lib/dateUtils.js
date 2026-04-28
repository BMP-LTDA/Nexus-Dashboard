/**
 * Utility functions for handling dates in Brasília Timezone (UTC-3)
 */

export const BRASILIA_TIMEZONE = 'America/Sao_Paulo';

/**
 * Returns the current date/time adjusted to Brasília timezone
 */
export function getBrasiliaNow() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: BRASILIA_TIMEZONE }));
}

/**
 * Format a date string or object to dd/MM in Brasília timezone
 */
export function formatToBrasiliaDayMonth(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: BRASILIA_TIMEZONE
  }).format(d);
}

/**
 * Helper: Converts a local year, month, day to a UTC JS Date that represents
 * that exact date at a specific hour in Brasília Time (UTC-3).
 * isEnd = false -> 00:00 BRT -> 03:00 UTC
 * isEnd = true  -> 23:59:59.999 BRT -> 02:59:59.999 UTC next day
 */
function getBrBoundary(localDateObj, isEnd = false) {
  const y = localDateObj.getFullYear();
  const m = localDateObj.getMonth();
  const d = localDateObj.getDate();
  
  if (!isEnd) {
    return new Date(Date.UTC(y, m, d, 3, 0, 0, 0));
  } else {
    return new Date(Date.UTC(y, m, d, 26, 59, 59, 999));
  }
}

/**
 * Returns a cutoff date for X days ago in Brasília timezone
 */
export function getBrasiliaCutoff(days) {
  const now = new Date();
  const options = { timeZone: BRASILIA_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);
  const mm = parseInt(parts.find(p => p.type === 'month').value, 10) - 1;
  const dd = parseInt(parts.find(p => p.type === 'day').value, 10);
  const yyyy = parseInt(parts.find(p => p.type === 'year').value, 10);

  const localD = new Date(yyyy, mm, dd);
  localD.setDate(localD.getDate() - (days - 1));
  
  return getBrBoundary(localD, false);
}

export function isWithinLastDays(dateStr, days) {
  const date = new Date(dateStr);
  const cutoff = getBrasiliaCutoff(days);
  return date >= cutoff;
}

/**
 * Retorna os intervalos exatos de data (início e fim) para o período atual e o período anterior.
 * Os objetos Date retornados representam corretamente os horários em UTC 
 * equivalentes à meia-noite (início) e 23:59 (fim) do fuso de Brasília.
 */
export function getPeriodDateRanges(period, customRange = null) {
  const now = new Date();
  const options = { timeZone: BRASILIA_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);
  const mm = parseInt(parts.find(p => p.type === 'month').value, 10) - 1; 
  const dd = parseInt(parts.find(p => p.type === 'day').value, 10);
  const yyyy = parseInt(parts.find(p => p.type === 'year').value, 10);

  const todayLocal = new Date(yyyy, mm, dd);

  let currentStart, currentEnd, priorStart, priorEnd;

  if (period === 'today') {
    currentStart = getBrBoundary(todayLocal, false);
    currentEnd = getBrBoundary(todayLocal, true);
    
    const prev = new Date(todayLocal);
    prev.setDate(prev.getDate() - 1);
    priorStart = getBrBoundary(prev, false);
    priorEnd = getBrBoundary(prev, true);
  } else if (period === '7d') {
    const start = new Date(todayLocal);
    start.setDate(start.getDate() - 6);
    currentStart = getBrBoundary(start, false);
    currentEnd = getBrBoundary(todayLocal, true);
    
    const pStart = new Date(start);
    pStart.setDate(pStart.getDate() - 7);
    priorStart = getBrBoundary(pStart, false);
    
    const pEnd = new Date(start);
    pEnd.setDate(pEnd.getDate() - 1);
    priorEnd = getBrBoundary(pEnd, true);
  } else if (period === '30d') {
    const start = new Date(todayLocal);
    start.setDate(start.getDate() - 29);
    currentStart = getBrBoundary(start, false);
    currentEnd = getBrBoundary(todayLocal, true);
    
    const pStart = new Date(start);
    pStart.setDate(pStart.getDate() - 30);
    priorStart = getBrBoundary(pStart, false);
    
    const pEnd = new Date(start);
    pEnd.setDate(pEnd.getDate() - 1);
    priorEnd = getBrBoundary(pEnd, true);
  } else if (period === '90d') {
    const start = new Date(todayLocal);
    start.setDate(start.getDate() - 89);
    currentStart = getBrBoundary(start, false);
    currentEnd = getBrBoundary(todayLocal, true);
    
    const pStart = new Date(start);
    pStart.setDate(pStart.getDate() - 90);
    priorStart = getBrBoundary(pStart, false);
    
    const pEnd = new Date(start);
    pEnd.setDate(pEnd.getDate() - 1);
    priorEnd = getBrBoundary(pEnd, true);
  } else if (period === 'month') {
    const start = new Date(todayLocal);
    start.setDate(1);
    currentStart = getBrBoundary(start, false);
    currentEnd = getBrBoundary(todayLocal, true);
    
    const pStart = new Date(start);
    pStart.setMonth(pStart.getMonth() - 1);
    pStart.setDate(1);
    priorStart = getBrBoundary(pStart, false);
    
    const pEnd = new Date(start);
    pEnd.setDate(0); 
    priorEnd = getBrBoundary(pEnd, true);
  } else if (period === 'prev-month') {
    const end = new Date(todayLocal);
    end.setDate(0);
    currentEnd = getBrBoundary(end, true);
    
    const start = new Date(end);
    start.setDate(1);
    currentStart = getBrBoundary(start, false);
    
    const pEnd = new Date(start);
    pEnd.setDate(0);
    priorEnd = getBrBoundary(pEnd, true);
    
    const pStart = new Date(pEnd);
    pStart.setDate(1);
    priorStart = getBrBoundary(pStart, false);
  } else if (period === 'year') {
    const start = new Date(todayLocal);
    start.setMonth(0, 1);
    currentStart = getBrBoundary(start, false);
    currentEnd = getBrBoundary(todayLocal, true);
    
    const pStart = new Date(start);
    pStart.setFullYear(pStart.getFullYear() - 1);
    priorStart = getBrBoundary(pStart, false);
    
    const pEnd = new Date(todayLocal);
    pEnd.setFullYear(pEnd.getFullYear() - 1);
    priorEnd = getBrBoundary(pEnd, true);
  } else if (period === 'custom' && customRange?.start && customRange?.end) {
    const [sy, sm, sd] = customRange.start.split('-').map(Number);
    const [ey, em, ed] = customRange.end.split('-').map(Number);
    
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    currentStart = getBrBoundary(start, false);
    currentEnd = getBrBoundary(end, true);
    
    const diffTimeMs = currentEnd.getTime() - currentStart.getTime();
    
    const pEnd = new Date(start);
    pEnd.setDate(pEnd.getDate() - 1);
    priorEnd = getBrBoundary(pEnd, true);
    
    priorStart = new Date(priorEnd.getTime() - diffTimeMs); 
  } else {
    // Default fallback to 30d
    const start = new Date(todayLocal);
    start.setDate(start.getDate() - 29);
    currentStart = getBrBoundary(start, false);
    currentEnd = getBrBoundary(todayLocal, true);
    
    const pStart = new Date(start);
    pStart.setDate(pStart.getDate() - 30);
    priorStart = getBrBoundary(pStart, false);
    
    const pEnd = new Date(start);
    pEnd.setDate(pEnd.getDate() - 1);
    priorEnd = getBrBoundary(pEnd, true);
  }

  return {
    current: { start: currentStart, end: currentEnd },
    prior: { start: priorStart, end: priorEnd }
  };
}
