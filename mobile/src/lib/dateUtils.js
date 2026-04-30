// Mesmo arquivo do web — sem dependências de browser, funciona no RN
export const BRASILIA_TIMEZONE = 'America/Sao_Paulo';

export function getBrasiliaNow() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: BRASILIA_TIMEZONE }));
}

function getBrBoundary(localDateObj, isEnd = false) {
  const y = localDateObj.getFullYear();
  const m = localDateObj.getMonth();
  const d = localDateObj.getDate();
  if (!isEnd) return new Date(Date.UTC(y, m, d, 3, 0, 0, 0));
  return new Date(Date.UTC(y, m, d, 26, 59, 59, 999));
}

export function getPeriodDateRanges(period, customRange = null) {
  const now = new Date();
  const options = { timeZone: BRASILIA_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
  const mm = parseInt(parts.find(p => p.type === 'month').value, 10) - 1;
  const dd = parseInt(parts.find(p => p.type === 'day').value, 10);
  const yyyy = parseInt(parts.find(p => p.type === 'year').value, 10);
  const todayLocal = new Date(yyyy, mm, dd);

  let currentStart, currentEnd, priorStart, priorEnd;

  if (period === 'today') {
    currentStart = getBrBoundary(todayLocal, false);
    currentEnd   = getBrBoundary(todayLocal, true);
    const prev = new Date(todayLocal); prev.setDate(prev.getDate() - 1);
    priorStart = getBrBoundary(prev, false);
    priorEnd   = getBrBoundary(prev, true);
  } else if (period === '7d') {
    const start = new Date(todayLocal); start.setDate(start.getDate() - 6);
    currentStart = getBrBoundary(start, false);
    currentEnd   = getBrBoundary(todayLocal, true);
    const pStart = new Date(start); pStart.setDate(pStart.getDate() - 7);
    const pEnd   = new Date(start); pEnd.setDate(pEnd.getDate() - 1);
    priorStart = getBrBoundary(pStart, false);
    priorEnd   = getBrBoundary(pEnd, true);
  } else if (period === 'month') {
    const start = new Date(todayLocal); start.setDate(1);
    currentStart = getBrBoundary(start, false);
    currentEnd   = getBrBoundary(todayLocal, true);
    const pStart = new Date(start); pStart.setMonth(pStart.getMonth() - 1); pStart.setDate(1);
    const pEnd   = new Date(start); pEnd.setDate(0);
    priorStart = getBrBoundary(pStart, false);
    priorEnd   = getBrBoundary(pEnd, true);
  } else {
    // default 30d
    const start = new Date(todayLocal); start.setDate(start.getDate() - 29);
    currentStart = getBrBoundary(start, false);
    currentEnd   = getBrBoundary(todayLocal, true);
    const pStart = new Date(start); pStart.setDate(pStart.getDate() - 30);
    const pEnd   = new Date(start); pEnd.setDate(pEnd.getDate() - 1);
    priorStart = getBrBoundary(pStart, false);
    priorEnd   = getBrBoundary(pEnd, true);
  }

  return { current: { start: currentStart, end: currentEnd }, prior: { start: priorStart, end: priorEnd } };
}

export const PERIODS = [
  { key: 'today',  label: 'Hoje'       },
  { key: '7d',     label: '7 dias'     },
  { key: '30d',    label: '30 dias'    },
  { key: 'month',  label: 'Este mês'   },
];
