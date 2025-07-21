import React, { useState, useEffect } from 'react';
import { 
  HistoryItem, 
  ModuleType, 
  getModuleHistory, 
  deleteHistoryItem, 
  clearModuleHistory,
  downloadHistoryItem,
  downloadModuleHistory,
  formatTimestamp 
} from '../utils/historyManager';

interface HistoryViewerProps {
  module: ModuleType;
  isOpen: boolean;
  onClose: () => void;
}

const HistoryViewer: React.FC<HistoryViewerProps> = ({ module, isOpen, onClose }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  const moduleNames = {
    'rewrite': 'Viết Lại',
    'batch-rewrite': 'Viết Lại Hàng Loạt',
    'write-story': 'Viết Truyện',
    'batch-story': 'Viết Truyện Hàng Loạt'
  };

  // Load history when component mounts or module changes
  useEffect(() => {
    if (isOpen) {
      const moduleHistory = getModuleHistory(module);
      setHistory(moduleHistory);
    }
  }, [module, isOpen]);

  // Refresh history (call this after deleting items)
  const refreshHistory = () => {
    const moduleHistory = getModuleHistory(module);
    setHistory(moduleHistory);
  };

  const handleDelete = (itemId: string) => {
    if (confirm('Bạn có chắc muốn xóa bài này khỏi lịch sử?')) {
      deleteHistoryItem(module, itemId);
      refreshHistory();
      if (selectedItem && selectedItem.id === itemId) {
        setSelectedItem(null);
        setViewMode('list');
      }
    }
  };

  const handleClearAll = () => {
    if (confirm(`Bạn có chắc muốn xóa toàn bộ lịch sử ${moduleNames[module]}?`)) {
      clearModuleHistory(module);
      refreshHistory();
      setSelectedItem(null);
      setViewMode('list');
    }
  };

  const handleViewDetail = (item: HistoryItem) => {
    setSelectedItem(item);
    setViewMode('detail');
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    alert('Đã sao chép nội dung!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 text-white p-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            📚 Lịch Sử {moduleNames[module]} ({history.length}/5)
          </h3>
          <div className="flex gap-2">
            {history.length > 0 && (
              <>
                <button
                  onClick={() => downloadModuleHistory(module)}
                  className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded transition-colors"
                  title="Tải về tất cả"
                >
                  📥 Tải Tất Cả
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors"
                  title="Xóa tất cả"
                >
                  🗑️ Xóa Tất Cả
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              ✕ Đóng
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex h-[calc(90vh-200px)]">
          {/* History List */}
          <div className={`bg-gray-50 border-r overflow-y-auto ${viewMode === 'list' ? 'w-full' : 'w-1/3'}`}>
            {history.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-4">📝</div>
                <p className="text-lg font-medium mb-2">Chưa có lịch sử nào</p>
                <p className="text-sm">Các bài viết hoàn thành sẽ được lưu tự động ở đây</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {history.map((item, index) => (
                  <div
                    key={item.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedItem?.id === item.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    }`}
                    onClick={() => handleViewDetail(item)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {index + 1}. {item.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimestamp(item.timestamp)} • {item.metadata?.wordCount || 0} từ
                        </p>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadHistoryItem(item);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Tải về"
                        >
                          📥
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(item.content);
                          }}
                          className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                          title="Sao chép"
                        >
                          📋
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Xóa"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {item.content.length > 100 ? item.content.substring(0, 100) + '...' : item.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detail View */}
          {viewMode === 'detail' && selectedItem && (
            <div className="w-2/3 flex flex-col">
              {/* Detail Header */}
              <div className="p-4 border-b bg-white">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-lg text-gray-900 mb-1">
                      {selectedItem.title}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {formatTimestamp(selectedItem.timestamp)} • {selectedItem.metadata?.wordCount || 0} từ
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(selectedItem.content)}
                      className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded transition-colors"
                    >
                      📋 Sao chép
                    </button>
                    <button
                      onClick={() => downloadHistoryItem(selectedItem)}
                      className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
                    >
                      📥 Tải về
                    </button>
                    <button
                      onClick={() => {
                        setViewMode('list');
                        setSelectedItem(null);
                      }}
                      className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                    >
                      ← Quay lại
                    </button>
                  </div>
                </div>
              </div>

              {/* Detail Content */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                <div className="space-y-4">
                  {/* Main Content */}
                  <div>
                    <h5 className="font-medium text-gray-700 mb-2">Nội dung:</h5>
                    <div className="bg-white p-4 rounded-lg border">
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                        {selectedItem.content}
                      </pre>
                    </div>
                  </div>

                  {/* Original Text (if available) */}
                  {selectedItem.metadata?.originalText && (
                    <div>
                      <h5 className="font-medium text-gray-700 mb-2">Văn bản gốc:</h5>
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                          {selectedItem.metadata.originalText}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  {selectedItem.metadata?.settings && (
                    <div>
                      <h5 className="font-medium text-gray-700 mb-2">Cài đặt:</h5>
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <pre className="text-xs text-gray-600">
                          {JSON.stringify(selectedItem.metadata.settings, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            Lịch sử được lưu tự động và chỉ giữ lại 5 bài gần nhất cho mỗi module
          </p>
        </div>
      </div>
    </div>
  );
};

export default HistoryViewer;