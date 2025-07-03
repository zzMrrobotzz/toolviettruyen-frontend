import React, { useState } from 'react';
import { Card, Button, Row, Col, message, Typography, Spin } from 'antd';
import axios from 'axios';

const API_BASE = "https://key-manager-backend.onrender.com/api";

const PRICING = [
  { label: '100 bài viết', credit: 100, price: 500000 },
  { label: '220 bài viết', credit: 220, price: 1000000 },
  { label: '800 bài viết', credit: 800, price: 3000000 },
];

const RechargeModule: React.FC<{ currentKey: string }> = ({ currentKey }) => {
  const [credit, setCredit] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  // Lấy số credit hiện tại
  const fetchCredit = async () => {
    if (!currentKey) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/validate`, { key: currentKey });
      setCredit(res.data?.keyInfo?.credit ?? 0);
    } catch (err) {
      message.error('Không lấy được số credit!');
    }
    setLoading(false);
  };

  React.useEffect(() => {
    fetchCredit();
    // eslint-disable-next-line
  }, [currentKey]);

  // Nạp credit
  const handleRecharge = async (creditAmount: number) => {
    if (!currentKey) {
      message.error('Không tìm thấy key hiện tại!');
      return;
    }
    setPaying(true);
    try {
      const res = await axios.post(`${API_BASE}/payment/create`, { key: currentKey, credit: creditAmount });
      if (res.data?.payUrl) {
        window.open(res.data.payUrl, '_blank');
        message.info('Vui lòng quét QR và thanh toán. Sau khi thanh toán xong, bấm "Kiểm tra credit" để cập nhật.');
      } else {
        message.error('Không lấy được link thanh toán!');
      }
    } catch (err) {
      message.error('Lỗi tạo đơn thanh toán!');
    }
    setPaying(false);
  };

  return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <Card title="Nạp Credit" bordered>
        <Typography.Paragraph>
          <b>Key hiện tại:</b> <span style={{ color: '#1677ff' }}>{currentKey || 'Chưa đăng nhập'}</span><br />
          <b>Số credit còn lại:</b> {loading ? <Spin size="small" /> : <span style={{ color: '#52c41a' }}>{credit ?? '...'}</span>}
        </Typography.Paragraph>
        <Button onClick={fetchCredit} style={{ marginBottom: 24 }}>Kiểm tra credit</Button>
        <Row gutter={16}>
          {PRICING.map((pkg, idx) => (
            <Col span={8} key={idx}>
              <Card
                style={{ marginBottom: 16, textAlign: 'center' }}
                bordered
                title={pkg.label}
              >
                <div style={{ fontSize: 18, marginBottom: 8 }}><b>{pkg.price.toLocaleString()} VNĐ</b></div>
                <Button
                  type="primary"
                  loading={paying}
                  onClick={() => handleRecharge(pkg.credit)}
                  style={{ width: '100%' }}
                >
                  Nạp gói này
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
        <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
          Sau khi thanh toán, vui lòng bấm <b>"Kiểm tra credit"</b> để cập nhật số credit mới.<br />
          Nếu có vấn đề, liên hệ admin để được hỗ trợ.
        </Typography.Paragraph>
      </Card>
    </div>
  );
};

export default RechargeModule; 