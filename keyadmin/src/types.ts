export type AdminActiveModule =
  | 'dashboard'
  | 'keyManagement' // Hợp nhất user và key
  | 'apiProviders' // Quản lý API provider keys
  | 'billing'
  | 'suspiciousActivity'
  | 'apis'
  | 'settings';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  plan: 'Free' | 'Pro' | 'Enterprise';
  status: 'Active' | 'Suspended';
  joinDate: string; // ISO string
  lastLogin: string; // ISO string
  credits: number; // Renamed from creditsUsed to represent balance
}

export interface ApiStatus {
  id: string;
  provider: 'Gemini' | 'ElevenLabs' | 'Stability AI' | 'OpenAI' | 'DeepSeek';
  status: 'Operational' | 'Degraded' | 'Error';
  requestsToday: number;
  costToday: number; // in USD
  rateLimitUsage: number; // percentage
}

export interface DashboardData {
  totalKeys: number;
  activeKeys: number;
  expiredKeys: number;
  totalCredit: number;
  totalActiveCredit: number;
  // Các số liệu khác nếu có
}

export type ApiProviderType = 'Gemini' | 'ElevenLabs' | 'Stability AI' | 'OpenAI' | 'DeepSeek';

export interface ManagedApiKey {
  id: string;
  provider: ApiProviderType;
  nickname: string;
  key: string; // The actual key
  status: 'Active' | 'Inactive' | 'Depleted';
  usage: string; // e.g., "150k/1M credits" or "$15.2 / $50.0"
  lastChecked: string; // ISO string
}

// Types for Billing/Credit System
export interface CreditPackage {
  _id: string;
  name: string;
  price: number;
  credits: number;
  bonus?: string;
  isPopular?: boolean;
  isActive?: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  packageId: string;
  packageName: string;
  amount: number; // in VND
  creditsGranted: number;
  date: string; // ISO string
  status: 'Completed' | 'Pending' | 'Failed';
}

// Type for Suspicious Activity Monitoring
export interface SuspiciousActivityEvent {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  activityDescription: string;
  timestamp: string; // ISO string
  riskLevel: 'High' | 'Medium' | 'Low';
  status: 'New' | 'Investigating' | 'Resolved';
}

export interface AdminKey {
  _id: string;  // Backend dùng _id
  id?: string;  // Frontend alias cho _id
  key: string;
  credit: number;
  note: string;
  expiredAt: string | null;
  createdAt: string;
  isActive: boolean;
  maxActivations: number; // Từ backend
  isTrial?: boolean; // Optional vì backend không có
  __v?: number; // MongoDB version key
}

export interface ManagedApiProvider {
  _id: string; // Backend dùng _id
  id?: string; // Frontend alias
  name: string; // Đổi từ provider
  status: 'Operational' | 'Degraded' | 'Error' | 'Unknown'; // Đồng bộ với backend
  costToday: number;
  totalRequests: number;
  lastChecked: string;
} 