


import React, { useState } from 'react';
import { EditStoryModuleState } from '../../types';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { useAppContext } from '../../AppContext';

interface EditStoryModuleProps {
  moduleState: EditStoryModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<EditStoryModuleState>>;
}

const EditStoryModule: React.FC<EditStoryModuleProps> = () => {
  const { consumeCredit } = useAppContext();
  const [storyToEdit, setStoryToEdit] = useState('');
  const [targetLength, setTargetLength] = useState('5000');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedStory, setEditedStory] = useState<string | null>(null);

  const handleEditStory = async () => {
    if (!storyToEdit.trim()) {
      setError('Vui lòng nhập nội dung truyện cần biên tập.');
      return;
    }

    // Estimate credit cost (1 credit per 2000 characters)
    const estimatedCost = Math.max(1, Math.ceil(storyToEdit.length / 2000));
    
    const hasCredits = await consumeCredit(estimatedCost);
    if (!hasCredits) {
      setError(`Không đủ credit để biên tập truyện! Cần ${estimatedCost} credit.`);
      return;
    }

    setIsEditing(true);
    setError(null);
    setEditedStory(null);

    try {
      // TODO: Replace with actual backend endpoint when available
      await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate processing

      // This would be the actual implementation:
      // const response = await generateTextViaBackend({
      //   prompt: `Biên tập truyện sau đây với mục tiêu độ dài khoảng ${targetLength} từ:\n\n${storyToEdit}`,
      //   provider: 'gemini',
      //   systemInstruction: 'Bạn là một biên tập viên truyện chuyên nghiệp...',
      // });
      
      // if (!response.success) {
      //   throw new Error(response.error || 'Story editing failed');
      // }
      
      // setEditedStory(response.text);

      setError('Module biên tập truyện hiện đang được nâng cấp để tích hợp với backend. Vui lòng thử lại sau.');
      
    } catch (e) {
      setError(`Lỗi biên tập truyện: ${(e as Error).message}`);
    } finally {
      setIsEditing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Đã sao chép!');
  };

  return (
    <ModuleContainer title="✂️ Module Biên Tập Truyện">
      <InfoBox>
        <strong>💡 Thông báo:</strong> Module biên tập truyện hiện đang được nâng cấp để sử dụng backend proxy. 
        Tất cả API keys sẽ được quản lý qua webadmin. Chi phí: ~1 credit/2000 ký tự.
      </InfoBox>

      <div className="space-y-6">
        <div>
          <label htmlFor="storyToEdit" className="block text-sm font-medium text-gray-700 mb-1">
            Nội dung truyện cần biên tập:
          </label>
          <textarea
            id="storyToEdit"
            value={storyToEdit}
            onChange={(e) => setStoryToEdit(e.target.value)}
            rows={12}
            className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
            placeholder="Dán toàn bộ truyện bạn muốn biên tập vào đây..."
            disabled={isEditing}
          />
          <p className="text-xs text-gray-500 mt-1">
            Độ dài: {storyToEdit.length} ký tự (~{Math.max(1, Math.ceil(storyToEdit.length / 2000))} credit)
          </p>
        </div>

        <div>
          <label htmlFor="targetLength" className="block text-sm font-medium text-gray-700 mb-1">
            Mục tiêu độ dài sau biên tập: {parseInt(targetLength).toLocaleString()} từ
          </label>
          <input
            type="range"
            id="targetLength"
            min="1000"
            max="20000"
            step="1000"
            value={targetLength}
            onChange={(e) => setTargetLength(e.target.value)}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            disabled={isEditing}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1,000 từ</span>
            <span>20,000 từ</span>
          </div>
        </div>

        <button
          onClick={handleEditStory}
          disabled={isEditing || !storyToEdit.trim()}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isEditing ? 'Đang biên tập...' : '✂️ Biên Tập Truyện'}
        </button>

        {isEditing && <LoadingSpinner message="Đang phân tích và biên tập truyện..." />}
        {error && <ErrorAlert message={error} />}

        {editedStory && (
          <div className="p-4 border rounded-lg bg-green-50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-green-700">✅ Truyện Đã Biên Tập</h3>
              <button
                onClick={() => copyToClipboard(editedStory)}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                📋 Sao chép
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto bg-white p-4 border rounded">
              <div className="whitespace-pre-wrap">{editedStory}</div>
            </div>
          </div>
        )}

        <div className="mt-6 p-4 border rounded-lg bg-yellow-50">
          <h4 className="text-md font-semibold text-yellow-700 mb-2">🚧 Đang Phát Triển</h4>
          <ul className="text-sm text-yellow-600 space-y-1">
            <li>• Backend story editing API đang được phát triển</li>
            <li>• Phân tích chất lượng truyện tự động</li>
            <li>• Biên tập hàng loạt với concurrency</li>
            <li>• Tinh chỉnh sâu với AI</li>
            <li>• Tùy chọn ngôn ngữ và phong cách</li>
          </ul>
        </div>
      </div>
    </ModuleContainer>
  );
};

export default EditStoryModule;