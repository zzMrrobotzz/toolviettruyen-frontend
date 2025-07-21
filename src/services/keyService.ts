import axios from 'axios';

// --- Base API Configuration ---
const API_BASE = "/api";

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000, // 15 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor để handle lỗi tự động
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log error để debug
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message
    });
    return Promise.reject(error);
  }
);

// --- Enhanced Error Handling ---
const handleError = (error: any) => {
  if (error.response) {
    // Server responded với error status
    const status = error.response.status;
    const errorMsg = error.response.data?.message || error.response.data?.error || `Lỗi máy chủ: ${status}`;
    
    switch (status) {
      case 400:
        throw new Error(`Yêu cầu không hợp lệ: ${errorMsg}`);
      case 401:
        throw new Error('Không có quyền truy cập. Vui lòng đăng nhập lại.');
      case 403:
        throw new Error('Bạn không có quyền thực hiện hành động này.');
      case 404:
        throw new Error('Không tìm thấy tài nguyên yêu cầu.');
      case 429:
        throw new Error('Quá nhiều yêu cầu. Vui lòng thử lại sau.');
      case 500:
        throw new Error('Lỗi máy chủ nội bộ. Vui lòng thử lại sau.');
      case 503:
        throw new Error('Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.');
      default:
        throw new Error(errorMsg);
    }
  } else if (error.request) {
    // Request was made but no response received
    if (error.code === 'ECONNABORTED') {
      throw new Error('Kết nối quá chậm. Vui lòng kiểm tra mạng và thử lại.');
    }
    throw new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.');
  } else {
    // Something else happened
    throw new Error(error.message || 'Lỗi không xác định. Vui lòng thử lại.');
  }
};

// --- Retry Logic Helper ---
const retryRequest = async (requestFn: () => Promise<any>, maxRetries = 2) => {
  let lastError: any;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      
      // Không retry cho lỗi client (4xx)
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        throw error;
      }
      
      // Đợi trước khi retry
      if (i < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  throw lastError;
};

// --- API Service Functions ---

/**
 * Lấy dữ liệu thống kê tổng quan cho trang Dashboard.
 */
export const fetchDashboardStats = async () => {
  try {
    const response = await retryRequest(() => apiClient.get('/stats/dashboard'));
    
    // Validate response structure
    const data = response.data;
    if (!data || typeof data !== 'object') {
      console.warn('Dashboard stats response is not valid object:', data);
      return {
        billingStats: { totalRevenue: 0, monthlyTransactions: 0 },
        apiUsageStats: { totalRequests: 0, costToday: 0 }
      };
    }
    
    return data;
  } catch (error) {
    console.error('fetchDashboardStats error:', error);
    handleError(error);
  }
};

/**
 * Lấy danh sách tất cả các key.
 */
export const fetchKeys = async () => {
  try {
    const response = await retryRequest(() => apiClient.get('/keys'));
    
    // Validate response is array
    const data = response.data;
    if (!Array.isArray(data)) {
      console.warn('Keys response is not array:', data);
      return [];
    }
    
    return data;
  } catch (error) {
    console.error('fetchKeys error:', error);
    handleError(error);
  }
};

/**
 * Tạo một key mới.
 */
export const createKey = async (payload: { key: string; expiredAt?: Date; maxActivations?: number; note?: string; credit?: number }) => {
  try {
    // Validate payload
    if (!payload.key || typeof payload.key !== 'string') {
      throw new Error('Key không được để trống.');
    }
    
    const response = await apiClient.post('/keys', payload);
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

/**
 * Thu hồi (vô hiệu hóa) một key.
 */
export const revokeKey = async (key: string) => {
  try {
    if (!key || typeof key !== 'string') {
      throw new Error('Key không hợp lệ.');
    }
    
    const response = await apiClient.post('/keys/revoke', { key });
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

/**
 * Cập nhật (cộng/trừ) credit cho một key.
 */
export const updateCredit = async (key: string, amount: number) => {
  try {
    if (!key || typeof key !== 'string') {
      throw new Error('Key không hợp lệ.');
    }
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error('Số lượng credit không hợp lệ.');
    }
    
    const response = await apiClient.post('/keys/update-credit', { key, amount });
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

/**
 * Cập nhật các thông tin chi tiết của một key.
 */
export const updateKeyDetails = async (keyId: string, payload: { note?: string; expiredAt?: string | null; credit?: number; maxActivations?: number }) => {
  try {
    if (!keyId || typeof keyId !== 'string') {
      throw new Error('ID key không hợp lệ.');
    }
    
    // Validate payload
    if (payload.credit !== undefined && (typeof payload.credit !== 'number' || isNaN(payload.credit))) {
      throw new Error('Số lượng credit không hợp lệ.');
    }
    if (payload.maxActivations !== undefined && (typeof payload.maxActivations !== 'number' || isNaN(payload.maxActivations))) {
      throw new Error('Số lần kích hoạt tối đa không hợp lệ.');
    }
    
    const response = await apiClient.put(`/keys/${keyId}/details`, payload);
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

/**
 * Cập nhật trạng thái (active/inactive) của một key.
 */
export const updateKeyStatus = async (keyId: string, isActive: boolean) => {
  try {
    if (!keyId || typeof keyId !== 'string') {
      throw new Error('ID key không hợp lệ.');
    }
    if (typeof isActive !== 'boolean') {
      throw new Error('Trạng thái không hợp lệ.');
    }
    
    const response = await apiClient.put(`/keys/${keyId}/status`, { isActive });
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

/**
 * Lấy danh sách các nhà cung cấp API từ backend.
 */
export const fetchApiProviders = async () => {
    try {
        const response = await retryRequest(() => apiClient.get('/providers'));
        
        // Validate response is array
        const data = response.data;
        if (!Array.isArray(data)) {
          console.warn('API Providers response is not array:', data);
          return [];
        }
        
        return data;
    } catch (error) {
        console.error('fetchApiProviders error:', error);
        handleError(error);
    }
};

/**
 * Lấy danh sách các hoạt động gần đây (audit log).
 */
export const fetchAuditLogs = async () => {
    try {
        const response = await retryRequest(() => apiClient.get('/audit-log'));
        
        // Validate response is array
        const data = response.data;
        if (!Array.isArray(data)) {
          console.warn('Audit Logs response is not array:', data);
          return [];
        }
        
        return data;
    } catch (error) {
        console.error('fetchAuditLogs error:', error);
        handleError(error);
    }
};

/**
 * Lấy thống kê chi tiết các API requests hôm nay theo từng provider.
 */
export const fetchDailyApiStats = async () => {
  try {
    const response = await retryRequest(() => apiClient.get('/stats/daily-api-usage'));
    
    // Validate response is array
    const data = response.data;
    if (!Array.isArray(data)) {
      console.warn('Daily API stats response is not array:', data);
      return [];
    }
    
    return data;
  } catch (error) {
    console.error('fetchDailyApiStats error:', error);
    handleError(error);
  }
};

/**
 * Gửi yêu cầu tạo nội dung AI thông qua backend proxy.
 */
export const generateAiContent = async (prompt: string, provider: string, userKey: string) => {
  try {
    const response = await apiClient.post('/ai/generate', 
      { prompt, provider },
      { headers: { 'Authorization': `Bearer ${userKey}` } }
    );
    return response.data;
  } catch (error) {
    handleError(error);
  }
}; 