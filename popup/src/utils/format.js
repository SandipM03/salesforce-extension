/**
 * Formatting utilities
 */

export function formatCurrency(value) {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }
  if (typeof value === 'string' && !isNaN(parseFloat(value))) {
    return formatCurrency(parseFloat(value));
  }
  return value || '-';
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

export function getStageConfig(stage) {
  if (!stage) return { class: 'bg-gray-100 text-gray-600', label: '-' };
  
  const s = stage.toLowerCase();
  
  if (s.includes('prospect')) 
    return { class: 'bg-gray-100 text-gray-600', label: stage };
  if (s.includes('qualif')) 
    return { class: 'bg-blue-100 text-blue-700', label: stage };
  if (s.includes('proposal') || s.includes('value')) 
    return { class: 'bg-orange-100 text-orange-700', label: stage };
  if (s.includes('negot') || s.includes('review')) 
    return { class: 'bg-red-100 text-red-700', label: stage };
  if (s.includes('closed') && s.includes('won')) 
    return { class: 'bg-green-100 text-green-700', label: stage };
  if (s.includes('closed') && s.includes('lost')) 
    return { class: 'bg-gray-200 text-gray-500', label: stage };
  
  return { class: 'bg-gray-100 text-gray-600', label: stage };
}

export function truncate(str, len = 30) {
  if (!str) return '-';
  return str.length > len ? str.slice(0, len) + '...' : str;
}
