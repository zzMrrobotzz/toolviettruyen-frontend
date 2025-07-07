import React, { useState } from 'react';
import { Card, Button, Row, Col, Typography, Spin, Modal } from 'antd';
import axios from 'axios';
import QRCodeWrapper from './QRCodeWrapper';

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
  // State cho Modal custom
  const [modal, setModal] = useState<{ open: boolean, title: string, content: React.ReactNode, onOk?: () => void }>({ open: false, title: '', content: '', onOk: undefined });

  // Lấy số credit hiện tại
  const fetchCredit = async () => {
    if (!currentKey) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/validate`, { key: currentKey });
      setCredit(res.data?.keyInfo?.credit ?? 0);
    } catch (err) {
      setModal({ open: true, title: 'Lỗi', content: 'Không lấy được số credit!' });
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
      setModal({ open: true, title: 'Lỗi nạp credit', content: 'Không tìm thấy key hiện tại!' });
      return;
    }
    setPaying(true);
    try {
      const res = await axios.post(`${API_BASE}/payment/create`, { key: currentKey, credit: creditAmount });
      if (res.data?.payUrl) {
        setModal({
          open: true,
          title: 'Quét QR để thanh toán',
          content: (
            <div style={{ textAlign: 'center' }}>
              <QRCodeWrapper value={res.data.payUrl} size={200} />
              <div style={{ marginTop: 16 }}>
                <Button type="primary" onClick={() => window.open(res.data.payUrl, '_blank')}>
                  Mở trang thanh toán
                </Button>
              </div>
              <div style={{ marginTop: 16 }}>
                <b>Hướng dẫn:</b> Quét QR bằng app ngân hàng để thanh toán. Sau khi thanh toán xong, bấm <b>"Kiểm tra credit"</b> để cập nhật.<br />
                Nếu có vấn đề, liên hệ admin để được hỗ trợ.
              </div>
            </div>
          ),
          onOk: undefined
        });
      } else {
        setModal({ open: true, title: 'Lỗi nạp credit', content: 'Không lấy được link thanh toán!' });
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      const error: any = err;
      let detail = error?.response?.data?.message || error?.message || 'Lỗi tạo đơn thanh toán!';
      setModal({ open: true, title: 'Lỗi nạp credit', content: detail });
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
        <Row gutter={16}>
          {PRICING.map((pkg, idx) => (
            <Col span={8} key={idx}>
              <Card
                style={{ marginBottom: 16, textAlign: 'center', opacity: paying ? 0.7 : 1 }}
                bordered
                title={pkg.label}
              >
                <div style={{ fontSize: 18, marginBottom: 8 }}><b>{pkg.price.toLocaleString()} VNĐ</b></div>
                <Button
                  type="primary"
                  loading={paying}
                  disabled={paying}
                  onClick={() => handleRecharge(pkg.credit)}
                  style={{ width: '100%' }}
                >
                  {paying ? 'Đang xử lý...' : 'Nạp gói này'}
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
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