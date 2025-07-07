import React from 'react';
import { Card, Spin } from 'antd';

interface CreditAlertBoxProps {
  credit: number | null;
  loadingCredit: boolean;
}

const CreditAlertBox: React.FC<CreditAlertBoxProps> = ({ credit, loadingCredit }) => (
  <div style={{ maxWidth: 320, margin: '24px auto 0' }}>
    <Card bordered style={{ textAlign: 'center', background: '#f6ffed', borderColor: credit === 0 ? '#ff4d4f' : credit && credit < 10 ? '#faad14' : '#52c41a' }}>
      <span style={{ fontSize: 18, fontWeight: 600, color: credit === 0 ? '#ff4d4f' : credit && credit < 10 ? '#faad14' : '#389e0d' }}>
        💳 Credit còn lại: {loadingCredit ? <Spin size="small" /> : (credit !== null ? credit : '...')}
      </span>
    </Card>
  </div>
);

export default CreditAlertBox; 