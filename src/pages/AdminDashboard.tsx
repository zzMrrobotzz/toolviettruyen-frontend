import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import { fetchKeys, fetchDashboardStats, fetchAuditLogs, fetchApiProviders, fetchDailyApiStats } from '../services/keyService';
import { DollarSign, KeyRound, Users, Activity, Cpu, Cloud, Shield, CreditCard, TrendingUp, AlertTriangle } from 'lucide-react';
import { message, Empty, Row, Col, List, Card as AntCard, Spin } from 'antd';
import { AdminKey, ManagedApiProvider } from '../types';

// Helper để định dạng số và tiền tệ
const formatNumber = (value: number) => (value || 0).toLocaleString('vi-VN');
const formatCurrency = (value: number) => `${(value || 0).toLocaleString('vi-VN')} VNĐ`;

const AdminDashboard: React.FC = () => {
    // State cho từng phần dữ liệu với default values để tránh lỗi undefined
    const [keyStats, setKeyStats] = useState({ total: 0, active: 0, expired: 0 });
    const [billingStats, setBillingStats] = useState({ totalRevenue: 0, monthlyTransactions: 0 });
    const [apiUsageStats, setApiUsageStats] = useState({ totalRequests: 0, costToday: 0 });
    const [apiProviders, setApiProviders] = useState<ManagedApiProvider[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getDashboardData = async () => {
            try {
                setLoading(true);
                
                // Gọi song song các API để tải nhanh hơn với fallback handling
                const [keysData, statsData, providersData, dailyApiData, logsData] = await Promise.all([
                    fetchKeys().catch(() => []), // Fallback to empty array if failed
                    fetchDashboardStats().catch(() => null), // Fallback to null if failed
                    fetchApiProviders().catch(() => []), // Fallback to empty array if failed
                    fetchDailyApiStats().catch(() => []), // Fallback to empty array if failed
                    fetchAuditLogs().catch(() => []) // Fallback to empty array if failed
                ]);

                // Xử lý và cập nhật state cho Key với defensive programming
                if (keysData && Array.isArray(keysData) && keysData.length > 0) {
                    const now = new Date();
                    const activeKeys = keysData.filter((k: AdminKey) => k.isActive).length;
                    const expiredKeys = keysData.filter((k: AdminKey) => k.expiredAt && new Date(k.expiredAt) < now).length;
                    setKeyStats({ total: keysData.length, active: activeKeys, expired: expiredKeys });
                } else {
                    setKeyStats({ total: 0, active: 0, expired: 0 });
                }

                // ✅ FIX CRITICAL: Xử lý và cập nhật state cho Stats với defensive programming
                if (statsData && typeof statsData === 'object') {
                    // Đảm bảo billingStats có đúng cấu trúc - FIXES totalRevenue undefined
                    const safeBillingStats = {
                        totalRevenue: statsData.billingStats?.totalRevenue || 0,
                        monthlyTransactions: statsData.billingStats?.monthlyTransactions || 0
                    };
                    setBillingStats(safeBillingStats);

                    // Đảm bảo apiUsageStats có đúng cấu trúc  
                    const safeApiUsageStats = {
                        totalRequests: statsData.apiUsageStats?.totalRequests || 0,
                        costToday: statsData.apiUsageStats?.costToday || 0
                    };
                    setApiUsageStats(safeApiUsageStats);
                } else {
                    // Sử dụng default values nếu statsData không hợp lệ
                    setBillingStats({ totalRevenue: 0, monthlyTransactions: 0 });
                    setApiUsageStats({ totalRequests: 0, costToday: 0 });
                }

                // Merge daily API stats with providers data
                let mergedProviders = Array.isArray(providersData) ? providersData : [];
                if (Array.isArray(dailyApiData) && dailyApiData.length > 0) {
                    mergedProviders = mergedProviders.map(provider => {
                        const dailyStats = dailyApiData.find(daily => daily.provider?.toLowerCase() === provider.name?.toLowerCase());
                        return {
                            ...provider,
                            dailyRequests: dailyStats?.requests || 0
                        };
                    });
                }
                
                // Cập nhật state cho Providers và Logs với defensive programming  
                setApiProviders(mergedProviders);
                setAuditLogs(Array.isArray(logsData) ? logsData : []);

            } catch (error: any) {
                console.error('Dashboard data loading error:', error);
                message.error(error.message || 'Không thể tải dữ liệu dashboard!');
                
                // Đặt default values khi có lỗi
                setKeyStats({ total: 0, active: 0, expired: 0 });
                setBillingStats({ totalRevenue: 0, monthlyTransactions: 0 });
                setApiUsageStats({ totalRequests: 0, costToday: 0 });
                setApiProviders([]);
                setAuditLogs([]);
            } finally {
                setLoading(false);
            }
        };
        getDashboardData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spin size="large" tip="Đang tải dữ liệu hệ thống..." />
            </div>
        );
    }
    
    const activeProvidersCount = apiProviders.filter(p => p?.status === 'Operational').length;

    return (
        <div className="space-y-8 animate-fadeIn">
            <h1 className="text-3xl font-bold text-gray-800">Tổng Quan Hệ Thống</h1>
            
            {/* Key Statistics */}
            <div>
                <h2 className="text-xl font-semibold text-gray-700 mb-4">📊 Thống Kê Key</h2>
                <Row gutter={16}>
                    <Col span={6}><StatCard title="Tổng Số Key" value={formatNumber(keyStats.total)} Icon={KeyRound}/></Col>
                    <Col span={6}><StatCard title="Key Đang Hoạt Động" value={formatNumber(keyStats.active)} Icon={Users}/></Col>
                    <Col span={6}><StatCard title="Key Đã Hết Hạn" value={formatNumber(keyStats.expired)} Icon={Activity} changeType="negative"/></Col>
                    {/* Có thể thêm tổng credit nếu cần */}
                </Row>
            </div>

            {/* Billing Statistics */}
            <div>
                <h2 className="text-xl font-semibold text-gray-700 mb-4">💰 Thống Kê Doanh Thu</h2>
                <Row gutter={16}>
                    <Col span={6}><StatCard title="Tổng Doanh Thu" value={formatCurrency(billingStats.totalRevenue)} Icon={CreditCard}/></Col>
                    <Col span={6}><StatCard title="Giao Dịch Tháng Này" value={formatNumber(billingStats.monthlyTransactions)} Icon={Activity}/></Col>
                    {/* Các thống kê khác có thể thêm sau */}
                </Row>
            </div>

            {/* API Providers & Usage Statistics */}
            <div>
                <h2 className="text-xl font-semibold text-gray-700 mb-4">🧠 Thống Kê Sử Dụng API</h2>
                <Row gutter={16}>
                    <Col span={6}><StatCard title="Tổng Số Providers" value={formatNumber(apiProviders.length)} Icon={Cpu}/></Col>
                    <Col span={6}><StatCard title="Providers Hoạt Động" value={formatNumber(activeProvidersCount)} Icon={Shield}/></Col>
                    <Col span={6}><StatCard title="Tổng Requests Toàn Hệ Thống" value={formatNumber(apiUsageStats.totalRequests)} Icon={Cloud}/></Col>
                    <Col span={6}><StatCard title="Chi Phí Ước Tính Hôm Nay" value={`$${(apiUsageStats.costToday || 0).toFixed(2)}`} Icon={DollarSign}/></Col>
                </Row>
            </div>

            {/* Daily API Request Statistics by Provider */}
            <div>
                <h2 className="text-xl font-semibold text-gray-700 mb-4">📈 Thống Kê Request Hôm Nay Theo API</h2>
                <Row gutter={16}>
                    {apiProviders.map((provider, index) => {
                        const dailyRequests = provider.dailyRequests || 0;
                        const costToday = provider.costToday || 0;
                        return (
                            <Col span={6} key={provider._id || index}>
                                <AntCard size="small" className="h-full">
                                    <div className="text-center">
                                        <div className="text-lg font-semibold text-gray-800">{provider.name}</div>
                                        <div className="text-2xl font-bold text-blue-600 my-2">{formatNumber(dailyRequests)}</div>
                                        <div className="text-sm text-gray-500">requests hôm nay</div>
                                        <div className="text-sm text-green-600 font-medium">${costToday.toFixed(2)}</div>
                                        <div className={`inline-block w-2 h-2 rounded-full mt-1 ${
                                            provider.status === 'Operational' ? 'bg-green-500' : 
                                            provider.status === 'Error' ? 'bg-red-500' : 'bg-yellow-500'
                                        }`}></div>
                                    </div>
                                </AntCard>
                            </Col>
                        );
                    })}
                </Row>
            </div>

            {/* Recent Activity & Provider Status */}
            <Row gutter={16}>
                <Col span={12}>
                    <AntCard title="🛡️ Hoạt Động Gần Đây" size="small">
                        {auditLogs.length > 0 ? (
                            <List
                                size="small"
                                dataSource={auditLogs}
                                renderItem={(item: any) => (
                                    <List.Item>
                                        <div className="text-xs">
                                            <span className="text-gray-500 mr-2">[{new Date(item.timestamp).toLocaleString('vi-VN')}]</span>
                                            <span className="font-semibold text-blue-600">{item.action}:</span>
                                            <span className="ml-1">{item.details}</span>
                                        </div>
                                    </List.Item>
                                )}
                            />
                        ) : (
                            <Empty description="Chưa có hoạt động nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        )}
                    </AntCard>
                </Col>
                <Col span={12}>
                    <AntCard title="🧠 Trạng Thái API Providers" size="small">
                        {apiProviders.length > 0 ? (
                            <div className="space-y-3">
                                {apiProviders.map(provider => (
                                    <div key={provider._id} className="flex justify-between items-center">
                                        <div className="font-medium">{provider.name}</div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs text-gray-500">${(provider.costToday || 0).toFixed(2)}</span>
                                            <div className={`w-2 h-2 rounded-full ${
                                                provider.status === 'Operational' ? 'bg-green-500' : 
                                                provider.status === 'Error' ? 'bg-red-500' : 'bg-yellow-500' // Degraded
                                            }`}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <Empty description="Chưa có API providers nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        )}
                    </AntCard>
                </Col>
            </Row>
        </div>
    );
};

export default AdminDashboard; 