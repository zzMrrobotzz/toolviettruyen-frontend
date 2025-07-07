import React, { useState, useEffect } from 'react';
import ModuleContainer from '../ModuleContainer';
import InfoBox from '../InfoBox';
import axios from 'axios';

interface SupportModuleProps {
  apiSettings: { apiBase: string };
  currentKey: string;
}

const SupportModule: React.FC<SupportModuleProps> = ({ apiSettings, currentKey }) => {
  const [credit, setCredit] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCredit = async () => {
    if (!currentKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${apiSettings.apiBase}/validate`, { key: currentKey });
      setCredit(res.data?.keyInfo?.credit ?? 0);
    } catch (err) {
      setError('Không lấy được số credit!');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCredit();
    // eslint-disable-next-line
  }, [currentKey]);

  return (
    <ModuleContainer title="📞 Trung Tâm Hỗ Trợ & Liên Hệ">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="text-gray-700 text-base leading-relaxed mb-4">
          Nếu bạn cần hỗ trợ, giải đáp thắc mắc hoặc có bất kỳ yêu cầu nào liên quan đến 
          <strong> Tool Viết Truyện AI Story - ALL IN ONE</strong>, 
          vui lòng liên hệ với chúng tôi qua Zalo:
        </p>
        
        <div className="bg-gradient-to-r from-blue-500 to-teal-500 text-white p-6 rounded-lg shadow-lg text-center my-6">
          <p className="text-lg font-medium mb-1">Liên hệ Zalo:</p>
          <p className="text-3xl font-bold tracking-wider">0339933882</p>
          <p className="text-xl font-medium mt-1">(Đức Đại MMO)</p>
        </div>
        
        <InfoBox variant="info">
          <p className="font-semibold mb-1">Lưu ý khi liên hệ:</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>Vui lòng cung cấp thông tin chi tiết về vấn đề bạn gặp phải.</li>
            <li>Nếu có thể, hãy kèm theo ảnh chụp màn hình hoặc video mô tả lỗi.</li>
            <li>Thời gian phản hồi có thể từ vài phút đến vài giờ tùy thuộc vào số lượng yêu cầu.</li>
          </ul>
        </InfoBox>

        <p className="text-gray-700 text-base leading-relaxed mt-4">
          Chúng tôi luôn sẵn sàng lắng nghe và hỗ trợ bạn để có trải nghiệm tốt nhất với công cụ!
        </p>

        {/* Credit Display Card */}
        <div className="mt-8 flex justify-center">
          <div className="w-full max-w-xs bg-gradient-to-r from-green-400 to-blue-500 rounded-xl shadow-lg p-6 text-center">
            <div className="text-white text-lg font-semibold mb-2">💳 Số credit còn lại</div>
            <div className="text-3xl font-bold text-white mb-2">
              {loading ? 'Đang tải...' : (credit !== null ? credit : '...')}
            </div>
            {error && <div className="text-red-200 text-sm mb-2">{error}</div>}
            <button
              onClick={fetchCredit}
              className="mt-2 px-4 py-2 bg-white text-blue-600 font-semibold rounded shadow hover:bg-blue-50 transition"
              disabled={loading}
            >
              Kiểm tra credit
            </button>
          </div>
        </div>
      </div>
    </ModuleContainer>
  );
};

export default SupportModule;
