import React, { useState, useEffect } from 'react';
import { Card, Button, Table, message, Modal, Form, Input, InputNumber, Switch, Popconfirm, Space } from 'antd';
import { fetchPackages, createPackage, updatePackage, deletePackage } from '../services/keyService';
import { CreditPackage } from '../types'; // Sẽ cần cập nhật type này
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const AdminBilling: React.FC = () => {
    const [packages, setPackages] = useState<CreditPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingPackage, setEditingPackage] = useState<CreditPackage | null>(null);
    const [form] = Form.useForm();

    const loadPackages = async () => {
        setLoading(true);
        try {
            const data = await fetchPackages();
            setPackages(data || []);
        } catch (error: any) {
            message.error(error.message || 'Không thể tải danh sách gói cước');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPackages();
    }, []);

    const handleAddNew = () => {
        setEditingPackage(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (pkg: CreditPackage) => {
        setEditingPackage(pkg);
        form.setFieldsValue(pkg);
        setIsModalVisible(true);
    };

    const handleDelete = async (packageId: string) => {
        try {
            await deletePackage(packageId);
            message.success('Xóa gói cước thành công!');
            loadPackages();
        } catch (error: any) {
            message.error(error.message || 'Xóa gói cước thất bại');
        }
    };

    const handleFormSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (editingPackage) {
                await updatePackage(editingPackage._id, values);
                message.success('Cập nhật gói cước thành công!');
            } else {
                await createPackage(values);
                message.success('Tạo gói cước mới thành công!');
            }
            setIsModalVisible(false);
            loadPackages();
        } catch (error: any) {
            message.error(error.message || 'Thao tác thất bại');
        }
    };

    const columns = [
        { title: 'Tên Gói', dataIndex: 'name', key: 'name' },
        { title: 'Giá (VNĐ)', dataIndex: 'price', key: 'price', render: (price: number) => price.toLocaleString('vi-VN') },
        { title: 'Số Credit', dataIndex: 'credits', key: 'credits' },
        { title: 'Khuyến Mãi', dataIndex: 'bonus', key: 'bonus' },
        { title: 'Phổ Biến', dataIndex: 'isPopular', key: 'isPopular', render: (isPopular: boolean) => <Switch checked={isPopular} disabled /> },
        { title: 'Trạng Thái', dataIndex: 'isActive', key: 'isActive', render: (isActive: boolean) => <Switch checked={isActive} disabled /> },
        {
            title: 'Hành Động',
            key: 'action',
            render: (_: any, record: CreditPackage) => (
                <Space>
                    <Button icon={<EditOutlined />} onClick={() => handleEdit(record)}>Sửa</Button>
                    <Popconfirm
                        title="Bạn có chắc muốn xóa gói này?"
                        onConfirm={() => handleDelete(record._id)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Button icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Quản Lý Gói Cước</h1>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNew}>
                    Thêm Gói Mới
                </Button>
            </div>
            <Card>
                <Table
                    columns={columns}
                    dataSource={packages}
                    loading={loading}
                    rowKey="_id"
                    pagination={false}
                />
            </Card>
            <Modal
                title={editingPackage ? 'Sửa Gói Cước' : 'Tạo Gói Cước Mới'}
                open={isModalVisible}
                onOk={handleFormSubmit}
                onCancel={() => setIsModalVisible(false)}
                destroyOnClose
            >
                <Form form={form} layout="vertical" initialValues={{ isPopular: false, isActive: true }}>
                    <Form.Item name="name" label="Tên Gói" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="price" label="Giá (VNĐ)" rules={[{ required: true }]}>
                        <InputNumber 
                            min={0} 
                            style={{ width: '100%' }} 
                        />
                    </Form.Item>
                    <Form.Item name="credits" label="Số Credit" rules={[{ required: true }]}>
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="bonus" label="Khuyến Mãi (ví dụ: +10% tặng thêm)">
                        <Input />
                    </Form.Item>
                    <Form.Item name="isPopular" label="Đánh dấu là Gói Phổ Biến" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                    <Form.Item name="isActive" label="Hiển thị Gói này cho người dùng" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AdminBilling;