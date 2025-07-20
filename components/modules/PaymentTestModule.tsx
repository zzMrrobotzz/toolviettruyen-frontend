import React, { useState } from 'react';
import { Card, Button, Row, Col, Typography, Alert, List, message } from 'antd';
import axios from 'axios';
import { MAIN_API_URL } from '../../config';

const { Title, Text } = Typography;

/**
 * PAYMENT TEST MODULE - Test auto credit addition
 * 
 * This module helps test the auto credit system while waiting for real PayOS
 */

interface PendingPayment {
  _id: string;
  userKey: string;
  creditAmount: number;
  amount: number;
  orderCode: string;
  createdAt: string;
  status: string;
}

const PaymentTestModule: React.FC<{ currentKey: string }> = ({ currentKey }) => {
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [creditBefore, setCreditBefore] = useState<number | null>(null);
  const [creditAfter, setCreditAfter] = useState<number | null>(null);

  const fetchPendingPayments = async () => {
    try {
      const res = await axios.get(`${MAIN_API_URL}/mock-payos/payments?userKey=${currentKey}`);
      if (res.data.success) {
        setPendingPayments(res.data.payments);
      }
    } catch (error) {
      console.error('Failed to fetch pending payments:', error);
    }
  };

  const fetchUserCredit = async () => {
    try {
      const res = await axios.post(`${MAIN_API_URL}/keys/validate`, { key: currentKey });
      return res.data?.keyInfo?.credit || 0;
    } catch (error) {
      console.error('Failed to fetch user credit:', error);
      return 0;
    }
  };

  const testAutoPayment = async (orderCode: string, creditAmount: number) => {
    setLoading(true);
    
    try {
      // Get credit before
      const before = await fetchUserCredit();
      setCreditBefore(before);
      
      message.info(`Credit trước thanh toán: ${before}`);
      
      // Simulate payment completion
      const res = await axios.post(`${MAIN_API_URL}/mock-payos/complete-payment`, {
        orderCode,
        userKey: currentKey
      });
      
      if (res.data.success) {
        message.success(`✅ Mock payment completed for ${creditAmount} credits!`);
        
        // Wait a bit then check credit after
        setTimeout(async () => {
          const after = await fetchUserCredit();
          setCreditAfter(after);
          
          const diff = after - before;
          
          if (diff === creditAmount) {
            message.success(`🎉 AUTO CREDIT SUCCESS! Added ${diff} credits (${before} → ${after})`);
          } else {
            message.error(`❌ Credit mismatch. Expected +${creditAmount}, got +${diff}`);
          }
          
          // Refresh pending payments
          fetchPendingPayments();
        }, 2000);
        
      } else {
        message.error(`Payment test failed: ${res.data.error}`);
      }
      
    } catch (error: any) {
      message.error(`Payment test error: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (currentKey) {
      fetchPendingPayments();
      fetchUserCredit().then(setCreditBefore);
    }
  }, [currentKey]);

  const createTestPayment = async () => {
    try {
      // Create a test payment first
      const res = await axios.post(`${MAIN_API_URL}/payment/create`, {
        key: currentKey,
        creditAmount: 50  // Small test amount
      });
      
      if (res.data.success) {
        message.success('Test payment created! Check pending payments below.');
        fetchPendingPayments();
      }
    } catch (error: any) {
      message.error(`Failed to create test payment: ${error.response?.data?.error || error.message}`);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Card>
        <Title level={3}>🧪 Payment Auto Credit Test</Title>
        <Alert 
          message="Test Auto Credit Addition" 
          description="This module simulates PayOS payment completion to test automatic credit addition. Use this while waiting for real PayOS credentials."
          type="info" 
          showIcon 
          style={{ marginBottom: 24 }}
        />

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card size="small">
              <Text strong>Current Key:</Text><br/>
              <Text code>{currentKey}</Text>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Text strong>Credit Before:</Text><br/>
              <Text style={{ fontSize: 18, color: '#1890ff' }}>{creditBefore ?? '...'}</Text>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Text strong>Credit After:</Text><br/>
              <Text style={{ fontSize: 18, color: '#52c41a' }}>{creditAfter ?? '...'}</Text>
            </Card>
          </Col>
        </Row>

        <div style={{ marginBottom: 24 }}>
          <Button 
            type="primary" 
            onClick={createTestPayment}
            style={{ marginRight: 12 }}
          >
            Create Test Payment
          </Button>
          <Button onClick={fetchPendingPayments}>
            Refresh Pending Payments
          </Button>
        </div>

        <Title level={4}>Pending Payments for Testing:</Title>
        
        {pendingPayments.length === 0 ? (
          <Alert 
            message="No pending payments" 
            description="Create a test payment first, then use the buttons below to simulate completion."
            type="warning" 
          />
        ) : (
          <List
            dataSource={pendingPayments}
            renderItem={(payment) => (
              <List.Item
                actions={[
                  <Button
                    key="test"
                    type="primary"
                    size="small"
                    loading={loading}
                    onClick={() => testAutoPayment(payment.orderCode, payment.creditAmount)}
                  >
                    🧪 Test Auto Credit (+{payment.creditAmount})
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={`Order ${payment.orderCode}`}
                  description={
                    <div>
                      <div><strong>Credits:</strong> {payment.creditAmount}</div>
                      <div><strong>Amount:</strong> {payment.amount?.toLocaleString()} VNĐ</div>
                      <div><strong>Created:</strong> {new Date(payment.createdAt).toLocaleString()}</div>
                      <div><strong>Status:</strong> <span style={{ color: '#faad14' }}>{payment.status}</span></div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}

        <Alert 
          style={{ marginTop: 24 }}
          message="How Auto Credit Works" 
          description={
            <div>
              <p><strong>1. User creates payment</strong> → Payment stored as 'pending'</p>
              <p><strong>2. User pays via PayOS</strong> → PayOS sends webhook</p>
              <p><strong>3. Backend receives webhook</strong> → Automatically adds credits</p>
              <p><strong>4. Payment marked as 'completed'</strong> → User can use credits immediately</p>
              <br/>
              <Text strong>This test simulates step 2-4 to verify the auto credit system works!</Text>
            </div>
          }
          type="success" 
        />
      </Card>
    </div>
  );
};

export default PaymentTestModule;