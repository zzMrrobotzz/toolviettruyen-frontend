import React, { useState } from 'react';
import { Card, Button, Row, Col, Typography, Spin, Modal } from 'antd';
import axios from 'axios';
import { PAYMENT_API_URL, MAIN_API_URL } from '../../config';
import QRCodeWrapper from './QRCodeWrapper';
import { mockPaymentService } from '../../services/mockPaymentService';

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

  // 3 gói mặc định khi backend không có dữ liệu
  const defaultPackages: CreditPackage[] = [
    {
      _id: 'default-1',
      name: 'Gói Cơ Bản',
      price: 500000,
      credits: 100,
      bonus: '🔥 Khuyến mại',
      isPopular: false,
      isActive: true
    },
    {
      _id: 'default-2', 
      name: 'Gói Phổ Biến',
      price: 1000000,
      credits: 220,
      bonus: '💎 Tiết kiệm 10%',
      isPopular: true,
      isActive: true
    },
    {
      _id: 'default-3',
      name: 'Gói Premium',
      price: 3000000, 
      credits: 800,
      bonus: '🌟 Tiết kiệm 33%',
      isPopular: false,
      isActive: true
    }
  ];

  // Lấy danh sách gói credit từ backend
  const fetchPackages = async () => {
    setPackagesLoading(true);
    try {
      const res = await axios.get(`${MAIN_API_URL}/packages`);
      console.log('Packages response:', res.data);
      
      if (res.data.success && res.data.packages && res.data.packages.length > 0) {
        // Chỉ hiển thị gói đang active từ backend
        const activePackages = res.data.packages.filter((pkg: CreditPackage) => pkg.isActive !== false);
        setPackages(activePackages);
        console.log('Active packages loaded from backend:', activePackages.length);
      } else {
        // Fallback: Sử dụng gói mặc định khi backend không có dữ liệu
        console.log('Backend không có gói nào, sử dụng gói mặc định');
        setPackages(defaultPackages);
      }
    } catch (err) {
      console.error('Failed to fetch packages from backend, using default packages:', err);
      // Fallback: Sử dụng gói mặc định khi có lỗi
      setPackages(defaultPackages);
    }
    setPackagesLoading(false);
  };

  // Lấy số credit hiện tại
  const fetchCredit = async () => {
    if (!currentKey) return;
    setLoading(true);
    try {
      const res = await axios.post(`${MAIN_API_URL}/keys/validate`, { key: currentKey });
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

  // Khởi tạo gói mặc định nếu chưa có gói nào
  React.useEffect(() => {
    if (packages.length === 0 && !packagesLoading) {
      setPackages(defaultPackages);
    }
  }, []);

  // Nạp credit
  const handleRecharge = async (pkg: CreditPackage) => {
    console.log('handleRecharge called with package:', pkg);
    console.log('Current key:', currentKey);
    const creditAmount = pkg.credits;
    
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
      console.log('Creating payment for package:', pkg);
      console.log('Key:', currentKey);
      console.log('Credit amount:', creditAmount);
      console.log('Package price:', pkg.price);
      console.log('Payment API URL:', `${PAYMENT_API_URL}/api/payment/create`);
      
      // Thử các format khác nhau cho backend
      console.log('Trying different payload formats...');
      let res;
      const payloads = [
        // Thử với số nguyên rõ ràng
        { key: currentKey, creditAmount: parseInt(creditAmount.toString()) },
        { key: currentKey, credit_amount: parseInt(creditAmount.toString()) },
        // Thử với price thay vì credit
        { key: currentKey, amount: pkg.price },
        { key: currentKey, price: pkg.price, credits: creditAmount },
        // Format gốc
        { key: currentKey, creditAmount: creditAmount },
        { key: currentKey, packageId: pkg._id, amount: pkg.price, credits: pkg.credits },
        { key: currentKey, amount: creditAmount },
        { key: currentKey, credit: creditAmount },
        { key: currentKey, credits: creditAmount },
        // Thử format string
        { key: currentKey, creditAmount: creditAmount.toString() },
        { key: currentKey, package: pkg }
      ];

      let lastError = null;
      for (let i = 0; i < payloads.length; i++) {
        try {
          console.log(`Attempt ${i + 1} with payload:`, payloads[i]);
          res = await axios.post(`${PAYMENT_API_URL}/api/payment/create`, payloads[i]);
          console.log(`Attempt ${i + 1} succeeded!`);
          break;
        } catch (err) {
          console.log(`Attempt ${i + 1} failed:`, err.response?.data || err.message);
          lastError = err;
          if (i === payloads.length - 1) {
            throw lastError;
          }
        }
      }
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
                <Button 
                  type="primary" 
                  size="large"
                  onClick={() => window.open(payUrl, '_blank')}
                  style={{ marginRight: 8 }}
                >
                  🔗 Thanh toán PayOS
                </Button>
                <Button 
                  type="default"
                  onClick={() => {
                    // Auto-check payment status after opening PayOS
                    setTimeout(() => {
                      fetchCredit();
                    }, 5000);
                  }}
                >
                  ⏰ Kiểm tra tự động
                </Button>
              </div>
              
              <div style={{ fontSize: '13px', color: '#666' }}>
                <b>Hướng dẫn thanh toán:</b><br />
                🎯 <b>Tự động (PayOS):</b> Bấm "Thanh toán PayOS" → Chọn ngân hàng → Thanh toán → Credit tự động cộng<br />
                📱 <b>QR Code:</b> Quét mã QR bằng app ngân hàng → Thanh toán<br />
                🏦 <b>Chuyển khoản:</b> Chuyển theo thông tin trên + <b>GHI ĐÚNG nội dung</b><br />
                ⏰ Sau thanh toán: Credit sẽ tự động cập nhật trong vài phút<br />
                🆘 Cần hỗ trợ: Liên hệ admin nếu có vấn đề
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
      console.error('Payment creation error, falling back to mock service:', error);
      
      try {
        // Fallback to mock payment service
        console.log('Using mock payment service...');
        const mockResponse = await mockPaymentService.createPayment(currentKey, pkg);
        
        if (mockResponse.success) {
          const { transferInfo, qrData, payUrl } = mockResponse;
          setModal({
            open: true,
            title: 'Thông tin thanh toán',
            content: (
              <div>
                <div style={{ textAlign: 'center', marginBottom: 16, padding: 12, background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6 }}>
                  <p style={{ color: '#fa8c16', fontWeight: 'bold', marginBottom: 4, fontSize: 14 }}>🔧 Mock Payment Service</p>
                  <p style={{ fontSize: 12, color: '#666', margin: 0 }}>Sử dụng hệ thống thanh toán mô phỏng</p>
                </div>
                
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <QRCodeWrapper value={qrData || payUrl} size={200} />
                </div>

                <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                  <h4 style={{ margin: '0 0 12px 0' }}>🏦 Thông tin chuyển khoản</h4>
                  <p><strong>Ngân hàng:</strong> {transferInfo.bankName}</p>
                  <p><strong>Số tài khoản:</strong> {transferInfo.accountNumber}</p>
                  <p><strong>Chủ tài khoản:</strong> {transferInfo.accountHolder}</p>
                  <p><strong>Số tiền:</strong> {transferInfo.amount.toLocaleString('vi-VN')} VNĐ</p>
                  <p><strong>Nội dung:</strong> <code>{transferInfo.content}</code></p>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <Button 
                    type="primary" 
                    size="large"
                    onClick={() => window.open(payUrl, '_blank')}
                    style={{ marginRight: 8 }}
                  >
                    🔗 Thanh toán PayOS
                  </Button>
                  <Button 
                    type="default"
                    onClick={() => {
                      setTimeout(() => {
                        fetchCredit();
                      }, 5000);
                    }}
                  >
                    ⏰ Kiểm tra tự động
                  </Button>
                </div>
                
                <div style={{ fontSize: '13px', color: '#666' }}>
                  <b>Hướng dẫn thanh toán:</b><br />
                  🎯 <b>Tự động (PayOS):</b> Bấm "Thanh toán PayOS" → Chọn ngân hàng → Thanh toán → Credit tự động cộng<br />
                  📱 <b>QR Code:</b> Quét mã QR bằng app ngân hàng → Thanh toán<br />
                  🏦 <b>Chuyển khoản:</b> Chuyển theo thông tin trên + <b>GHI ĐÚNG nội dung</b><br />
                  ⏰ Sau thanh toán: Credit sẽ tự động cập nhật trong vài phút<br />
                  🆘 Cần hỗ trợ: Liên hệ admin nếu có vấn đề
                </div>
              </div>
            ),
          });
        } else {
          throw new Error('Mock payment service failed');
        }
      } catch (mockError) {
        console.error('Mock payment service also failed:', mockError);
        const detail = error?.response?.data?.error || error?.message || 'Lỗi tạo đơn thanh toán!';
        setModal({ open: true, title: 'Lỗi nạp credit', content: `Chi tiết lỗi: ${detail}` });
      }
      await new Promise(r => setTimeout(r, 1000));
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
                    onClick={() => handleRecharge(pkg)}
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
        <div style={{ marginTop: 16, padding: 16, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
          <Typography.Text strong style={{ color: '#0369a1' }}>
            💳 Thanh toán với PayOS - Nhanh chóng & An toàn
          </Typography.Text>
          <br />
          <Typography.Text type="secondary" style={{ fontSize: '13px' }}>
            ✅ Hỗ trợ tất cả ngân hàng Việt Nam<br />
            ✅ Credit tự động cộng sau thanh toán<br />
            ✅ QR Code tương thích mọi app ngân hàng<br />
            ✅ Bảo mật SSL 256-bit encryption
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
};

export default RechargeModule; 