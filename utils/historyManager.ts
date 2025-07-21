// History Management Utility for Writing Modules
// Manages localStorage-based history for RewriteModule, BatchRewriteModule, WriteStoryModule, BatchStoryWritingModule

export interface HistoryItem {
  id: string;
  timestamp: number;
  title: string; // Auto-generated from first 50 chars
  content: string; // Generated result content
  module: 'rewrite' | 'batch-rewrite' | 'write-story' | 'batch-story';
  metadata?: {
    originalText?: string;
    settings?: any;
    wordCount?: number;
  };
}

export type ModuleType = HistoryItem['module'];

const STORAGE_KEY = 'writing_modules_history_v1';
const MAX_ITEMS_PER_MODULE = 5;

// Get all history data from localStorage
export const getHistoryData = (): Record<ModuleType, HistoryItem[]> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {
        'rewrite': [],
        'batch-rewrite': [],
        'write-story': [],
        'batch-story': []
      };
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error reading history data:', error);
    return {
      'rewrite': [],
      'batch-rewrite': [],
      'write-story': [],
      'batch-story': []
    };
  }
};

// Save history data to localStorage
const saveHistoryData = (data: Record<ModuleType, HistoryItem[]>): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving history data:', error);
  }
};

// Generate title from content (first 50 chars)
const generateTitle = (content: string): string => {
  if (!content || content.trim().length === 0) {
    return 'Nội dung trống';
  }
  
  const cleanContent = content.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');
  if (cleanContent.length <= 50) {
    return cleanContent;
  }
  
  return cleanContent.substring(0, 47) + '...';
};

// Add new item to history
export const addToHistory = (
  module: ModuleType,
  content: string,
  metadata?: HistoryItem['metadata']
): void => {
  if (!content || content.trim().length === 0) {
    return; // Don't save empty content
  }

  const historyData = getHistoryData();
  const newItem: HistoryItem = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    title: generateTitle(content),
    content: content.trim(),
    module,
    metadata: {
      ...metadata,
      wordCount: content.trim().split(/\s+/).length
    }
  };

  // Add to beginning of array (newest first)
  historyData[module].unshift(newItem);
  
  // Keep only MAX_ITEMS_PER_MODULE newest items
  if (historyData[module].length > MAX_ITEMS_PER_MODULE) {
    historyData[module] = historyData[module].slice(0, MAX_ITEMS_PER_MODULE);
  }

  saveHistoryData(historyData);
};

// Get history for specific module
export const getModuleHistory = (module: ModuleType): HistoryItem[] => {
  const historyData = getHistoryData();
  return historyData[module] || [];
};

// Delete specific item from history
export const deleteHistoryItem = (module: ModuleType, itemId: string): void => {
  const historyData = getHistoryData();
  historyData[module] = historyData[module].filter(item => item.id !== itemId);
  saveHistoryData(historyData);
};

// Clear all history for a module
export const clearModuleHistory = (module: ModuleType): void => {
  const historyData = getHistoryData();
  historyData[module] = [];
  saveHistoryData(historyData);
};

// Get total history count across all modules
export const getTotalHistoryCount = (): number => {
  const historyData = getHistoryData();
  return Object.values(historyData).reduce((total, moduleHistory) => total + moduleHistory.length, 0);
};

// Export single item as downloadable text file
export const downloadHistoryItem = (item: HistoryItem): void => {
  const timestamp = new Date(item.timestamp).toLocaleString('vi-VN');
  const moduleNames = {
    'rewrite': 'Viết Lại',
    'batch-rewrite': 'Viết Lại Hàng Loạt', 
    'write-story': 'Viết Truyện',
    'batch-story': 'Viết Truyện Hàng Loạt'
  };
  
  const content = `=== ${moduleNames[item.module]} ===
Thời gian: ${timestamp}
Tiêu đề: ${item.title}
Số từ: ${item.metadata?.wordCount || 'N/A'}

=== NỘI DUNG ===
${item.content}

${item.metadata?.originalText ? `\n=== VĂN BẢN GỐC ===\n${item.metadata.originalText}` : ''}

---
Được tạo bởi Tool Viết Truyện AI
`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${moduleNames[item.module]}_${timestamp.replace(/[/:]/g, '-')}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Export all history for a module
export const downloadModuleHistory = (module: ModuleType): void => {
  const history = getModuleHistory(module);
  if (history.length === 0) {
    alert('Không có lịch sử nào để tải về.');
    return;
  }

  const moduleNames = {
    'rewrite': 'Viết Lại',
    'batch-rewrite': 'Viết Lại Hàng Loạt',
    'write-story': 'Viết Truyện', 
    'batch-story': 'Viết Truyện Hàng Loạt'
  };

  const content = `=== LỊCH SỬ ${moduleNames[module].toUpperCase()} ===
Tổng số bài: ${history.length}
Xuất vào: ${new Date().toLocaleString('vi-VN')}

${'='.repeat(60)}

${history.map((item, index) => {
  const timestamp = new Date(item.timestamp).toLocaleString('vi-VN');
  return `${index + 1}. ${item.title}
Thời gian: ${timestamp}
Số từ: ${item.metadata?.wordCount || 'N/A'}

${item.content}

${item.metadata?.originalText ? `--- Văn bản gốc ---\n${item.metadata.originalText}\n` : ''}${'='.repeat(60)}`;
}).join('\n\n')}

---
Được tạo bởi Tool Viết Truyện AI
`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Lich_Su_${moduleNames[module].replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Format timestamp for display
export const formatTimestamp = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) {
    return 'Vừa xong';
  } else if (minutes < 60) {
    return `${minutes} phút trước`;
  } else if (hours < 24) {
    return `${hours} giờ trước`;
  } else if (days < 7) {
    return `${days} ngày trước`;
  } else {
    return new Date(timestamp).toLocaleDateString('vi-VN');
  }
};