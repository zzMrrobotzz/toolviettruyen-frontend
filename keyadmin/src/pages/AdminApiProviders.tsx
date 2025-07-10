import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, message, Spin, Switch } from 'antd';
import { fetchApiProviders } from '../services/keyService'; // Sửa lại: dùng hàm mới
import { ManagedApiProvider } from '../types';

const AdminApiProviders: React.FC = () => {
    const [providers, setProviders] = useState<ManagedApiProvider[]>([]);
    const [loading, setLoading] = useState(true);

    const loadProviders = async () => {
        try {
            setLoading(true);
            const data = await fetchApiProviders();
            setProviders(data || []);
        } catch (error: any) {
            message.error(error.message || 'Không thể tải danh sách API providers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProviders();
    }, []);

    const handleStatusChange = async (providerId: string, newStatus: boolean) => {
        // Tạm thời chưa có API để cập nhật, sẽ thêm sau
        message.info('Chức năng cập nhật trạng thái đang được phát triển.');
        // Ví dụ khi có API:
        // try {
        //   await updateApiProviderStatus(providerId, newStatus ? 'Active' : 'Inactive');
        //   message.success('Cập nhật trạng thái thành công!');
        //   loadProviders(); 
        // } catch (error: any) {
        //   message.error(error.message || 'Cập nhật thất bại');
        // }
    };

    const columns = [
        { title: 'Nhà Cung Cấp', dataIndex: 'name', key: 'name' },
        { 
            title: 'Trạng Thái', 
            dataIndex: 'status', 
            key: 'status',
            render: (status: string) => {
                let color = 'grey';
                if (status === 'Operational') color = 'green';
                if (status === 'Degraded') color = 'orange';
                if (status === 'Error') color = 'red';
                return <Tag color={color}>{status}</Tag>;
            }
        },
        { title: 'Tổng Requests', dataIndex: 'totalRequests', key: 'totalRequests', render: (val: number) => (val || 0).toLocaleString() },
        { title: 'Chi phí Hôm Nay', dataIndex: 'costToday', key: 'costToday', render: (val: number) => `$${(val || 0).toFixed(2)}` },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: ManagedApiProvider) => (
                <Switch
                    checkedChildren="Hoạt động"
                    unCheckedChildren="Tắt"
                    checked={record.status === 'Operational'}
                    onChange={(checked) => handleStatusChange(record._id, checked)}
                    disabled // Tạm thời vô hiệu hóa cho đến khi có API
                />
            ),
        },
    ];

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spin size="large" tip="Đang tải danh sách nhà cung cấp..." />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Quản Lý API Providers</h1>
                <Button type="primary" onClick={loadProviders} loading={loading}>
                    Làm Mới
                </Button>
            </div>
            <Table
                columns={columns}
                dataSource={providers}
                rowKey="_id"
                pagination={false}
            />
        </div>
    );
};

export default AdminApiProviders;