import React, { useState } from 'react';
import { TtsModuleState } from '../../types';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { useAppContext } from '../../AppContext';

interface TtsModuleProps {
  moduleState: TtsModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<TtsModuleState>>;
}

const TtsModule: React.FC<TtsModuleProps> = ({ moduleState, setModuleState }) => {
  const { consumeCredit } = useAppContext();
  const [textToSpeak, setTextToSpeak] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleGenerateSpeech = async () => {
    if (!textToSpeak.trim()) {
      setError('Vui lòng nhập văn bản để chuyển đổi thành giọng nói.');
      return;
    }

    // Estimate credit cost based on text length
    const textLength = textToSpeak.length;
    const estimatedCost = Math.max(1, Math.ceil(textLength / 1000)); // 1 credit per 1000 chars

    const hasCredits = await consumeCredit(estimatedCost);
    if (!hasCredits) {
      setError(`Không đủ credit để tạo TTS! Cần ${estimatedCost} credit.`);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setAudioUrl(null);

    try {
      // TODO: Replace with actual backend TTS endpoint when available
      // For now, show success message
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing

      // This would be the actual implementation:
      // const response = await fetch('/api/tts/generate', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${localStorage.getItem('user_key')}`,
      //   },
      //   body: JSON.stringify({
      //     text: textToSpeak,
      //     voice: 'default',
      //   }),
      // });
      
      // if (!response.ok) {
      //   throw new Error('TTS generation failed');
      // }
      
      // const audioBlob = await response.blob();
      // const url = URL.createObjectURL(audioBlob);
      // setAudioUrl(url);

      setError('TTS module hiện đang được nâng cấp để tích hợp với backend. Vui lòng thử lại sau.');
      
    } catch (e) {
      setError(`Lỗi tạo TTS: ${(e as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = 'generated-speech.mp3';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ModuleContainer title="🎙️ Module: Chuyển văn bản thành giọng nói (TTS)">
      <InfoBox>
        <strong>💡 Thông báo:</strong> Module TTS hiện đang được nâng cấp để sử dụng backend proxy. 
        Tất cả API keys sẽ được quản lý qua webadmin. Chi phí: ~1 credit/1000 ký tự.
      </InfoBox>

      <div className="space-y-6">
        <div>
          <label htmlFor="textToSpeak" className="block text-sm font-medium text-gray-700 mb-1">
            Văn bản cần chuyển đổi:
          </label>
          <textarea
            id="textToSpeak"
            value={textToSpeak}
            onChange={(e) => setTextToSpeak(e.target.value)}
            rows={6}
            className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
            placeholder="Nhập văn bản bạn muốn chuyển thành giọng nói..."
            disabled={isGenerating}
          />
          <p className="text-xs text-gray-500 mt-1">
            Độ dài: {textToSpeak.length} ký tự (~{Math.max(1, Math.ceil(textToSpeak.length / 1000))} credit)
          </p>
        </div>

        <button
          onClick={handleGenerateSpeech}
          disabled={isGenerating || !textToSpeak.trim()}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isGenerating ? 'Đang tạo TTS...' : '🎙️ Tạo Giọng Nói'}
        </button>

        {isGenerating && <LoadingSpinner message="Đang xử lý văn bản và tạo âm thanh..." />}
        {error && <ErrorAlert message={error} />}

        {audioUrl && (
          <div className="p-4 border rounded-lg bg-green-50">
            <h3 className="text-lg font-semibold mb-2 text-green-700">🎉 TTS Hoàn Thành!</h3>
            <div className="space-y-3">
              <audio controls src={audioUrl} className="w-full">
                Trình duyệt của bạn không hỗ trợ phát âm thanh.
              </audio>
              <button
                onClick={downloadAudio}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                📥 Tải về
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 p-4 border rounded-lg bg-yellow-50">
          <h4 className="text-md font-semibold text-yellow-700 mb-2">🚧 Đang Phát Triển</h4>
          <ul className="text-sm text-yellow-600 space-y-1">
            <li>• Backend TTS API đang được phát triển</li>
            <li>• Hỗ trợ nhiều giọng đọc (nam/nữ, các ngôn ngữ)</li>
            <li>• Tối ưu hóa chất lượng âm thanh</li>
            <li>• Phân đoạn tự động cho văn bản dài</li>
          </ul>
        </div>
      </div>
    </ModuleContainer>
  );
};

export default TtsModule;
