import React, { useState } from 'react';
import { Card, Button, Row, Col, Typography, Spin, Modal } from 'antd';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import QRCodeWrapper from './QRCodeWrapper';

interface CreditPackage {
  _id: string;
  name: string;
  price: number;
  credits: number;
  bonus?: string;
  isPopular?: boolean;
  isActive?: boolean;
}

const RechargeModule: React.FC<{ currentKey: string }> = ({ currentKey }) => {
  const [credit, setCredit] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  // State cho Modal custom
  const [modal, setModal] = useState<{ open: boolean, title: string, content: React.ReactNode, onOk?: () => void }>({ open: false, title: '', content: '', onOk: undefined });

  // Lấy danh sách gói credit từ backend
  const fetchPackages = async () => {
    setPackagesLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/packages`);
      // Chỉ hiển thị gói đang active
      const activePackages = res.data.filter((pkg: CreditPackage) => pkg.isActive !== false);
      setPackages(activePackages);
    } catch (err) {
      console.error('Failed to fetch packages:', err);
      setModal({ open: true, title: 'Lỗi', content: 'Không lấy được danh sách gói credit!' });
    }
    setPackagesLoading(false);
  };

  // Lấy số credit hiện tại
  const fetchCredit = async () => {
    if (!currentKey) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/keys/validate`, { key: currentKey });
      setCredit(res.data?.keyInfo?.credit ?? 0);
    } catch (err) {
      setModal({ open: true, title: 'Lỗi', content: 'Không lấy được số credit!' });
    }
    setLoading(false);
  };

  React.useEffect(() => {
    fetchCredit();
    fetchPackages();
    // eslint-disable-next-line
  }, [currentKey]);

  // Nạp credit
  const handleRecharge = async (creditAmount: number) => {
    console.log('handleRecharge called with:', { creditAmount, currentKey });
    
    if (!currentKey || currentKey.trim() === '') {
      console.error('No currentKey available:', { currentKey, length: currentKey?.length });
      setModal({ 
        open: true, 
        title: 'Lỗi nạp credit', 
        content: (
          <div>
            <p>Không tìm thấy key hiện tại!</p>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              Debug: currentKey = "{currentKey}" (length: {currentKey?.length || 0})
            </p>
            <p style={{ fontSize: '12px', color: '#666' }}>
              Vui lòng đăng nhập lại để sử dụng tính năng này.
            </p>
          </div>
        )
      });
      return;
    }
    setPaying(true);
    try {
      console.log('Creating payment for:', { key: currentKey, credit: creditAmount });
      console.log('API URL:', `${API_BASE_URL}/payment/create`);
      
      const res = await axios.post(`${API_BASE_URL}/payment/create`, { key: currentKey, credit: creditAmount });
      console.log('Payment response:', res.data);
      if (res.data?.success && res.data?.transferInfo) {
        const { transferInfo, qrData, payUrl } = res.data;
        setModal({
          open: true,
          title: 'Thông tin thanh toán',
          content: (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <QRCodeWrapper value={qrData || payUrl} size={200} />
              </div>
              
              <div style={{ backgroundColor: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 8px 0' }}>Thông tin chuyển khoản:</h4>
                <div><b>Ngân hàng:</b> {transferInfo.bankName}</div>
                <div><b>Số tài khoản:</b> {transferInfo.accountNumber}</div>
                <div><b>Tên người nhận:</b> {transferInfo.accountName}</div>
                <div><b>Số tiền:</b> <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{transferInfo.amount.toLocaleString()} VND</span></div>
                <div><b>Nội dung CK:</b> <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{transferInfo.content}</span></div>
              </div>

              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <Button type="primary" onClick={() => window.open(payUrl, '_blank')}>
                  Mở trang thanh toán
                </Button>
              </div>
              
              <div style={{ fontSize: '13px', color: '#666' }}>
                <b>Hướng dẫn:</b><br />
                1. Quét QR hoặc chuyển khoản theo thông tin trên<br />
                2. <b>BẮT BUỘC</b> ghi đúng nội dung chuyển khoản<br />
                3. Sau khi chuyển khoản, bấm <b>"Kiểm tra credit"</b> để cập nhật<br />
                4. Nếu có vấn đề, liên hệ admin để được hỗ trợ
              </div>
            </div>
          ),
          onOk: undefined
        });
      } else {
        setModal({ open: true, title: 'Lỗi nạp credit', content: res.data?.error || 'Không tạo được đơn thanh toán!' });
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      const error: any = err;
      console.error('Payment creation error:', error);
      console.error('Error response:', error?.response?.data);
      
      let detail = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Lỗi tạo đơn thanh toán!';
      setModal({ open: true, title: 'Lỗi nạp credit', content: `Chi tiết lỗi: ${detail}` });
      await new Promise(r => setTimeout(r, 2000));
    }
    setPaying(false);
  };

  return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      {/* Modal custom */}
      <Modal
        open={modal.open}
        title={modal.title}
        onOk={() => {
          setModal({ ...modal, open: false });
          if (modal.onOk) modal.onOk();
        }}
        onCancel={() => setModal({ ...modal, open: false })}
        okText="OK"
        cancelText="Đóng"
      >
        {modal.content}
      </Modal>
      <Card title="Nạp Credit" bordered>
        <Typography.Paragraph>
          <b>Key hiện tại:</b> <span style={{ color: '#1677ff' }}>{currentKey || 'Chưa đăng nhập'}</span><br />
          <b>Số credit còn lại:</b> {loading ? <Spin size="small" /> : <span style={{ color: '#52c41a' }}>{credit ?? '...'}</span>}
        </Typography.Paragraph>
        <Button onClick={fetchCredit} style={{ marginBottom: 24 }}>Kiểm tra credit</Button>
        
        {packagesLoading ? (
          <div style={{ textAlign: 'center', margin: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 8 }}>Đang tải gói credit...</div>
          </div>
        ) : packages.length === 0 ? (
          <div style={{ textAlign: 'center', margin: '40px 0', color: '#666' }}>
            Hiện tại không có gói credit nào khả dụng.
          </div>
        ) : (
          <Row gutter={16}>
            {packages.map((pkg) => (
              <Col span={8} key={pkg._id}>
                <Card
                  style={{ 
                    marginBottom: 16, 
                    textAlign: 'center', 
                    opacity: paying ? 0.7 : 1,
                    border: pkg.isPopular ? '2px solid #1890ff' : undefined
                  }}
                  bordered
                  title={
                    <div>
                      {pkg.name}
                      {pkg.isPopular && (
                        <span style={{ 
                          background: '#1890ff', 
                          color: 'white', 
                          fontSize: '12px', 
                          padding: '2px 8px', 
                          borderRadius: '12px', 
                          marginLeft: '8px' 
                        }}>
                          Phổ biến
                        </span>
                      )}
                    </div>
                  }
                >
                  <div style={{ fontSize: 18, marginBottom: 8 }}>
                    <b>{pkg.price.toLocaleString()} VNĐ</b>
                  </div>
                  <div style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
                    {pkg.credits} credit{pkg.bonus && ` + ${pkg.bonus}`}
                  </div>
                  <Button
                    type="primary"
                    loading={paying}
                    disabled={paying}
                    onClick={() => handleRecharge(pkg.credits)}
                    style={{ width: '100%' }}
                  >
                    {paying ? 'Đang xử lý...' : 'Nạp gói này'}
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        )}
        {paying && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Spin size="large" />
            <div style={{ marginTop: 8, color: '#1677ff' }}>
              Đang tạo đơn thanh toán, vui lòng chờ...
            </div>
          </div>
        )}
        <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
          Sau khi thanh toán, vui lòng bấm <b>"Kiểm tra credit"</b> để cập nhật số credit mới.<br />
          Nếu có vấn đề, liên hệ admin để được hỗ trợ.
        </Typography.Paragraph>
      </Card>
    </div>
  );
};

export default RechargeModule; 