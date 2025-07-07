import React from 'react';

// Simple QR Code fallback - prevents require() errors
const QRCodeWrapper = (props: any) => {
  return (
    <div style={{ 
      padding: '20px', 
      textAlign: 'center', 
      border: '2px dashed #1976d2',
      borderRadius: '8px',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{ fontSize: '16px', marginBottom: '8px' }}>QR Code</div>
      <div style={{ fontSize: '12px', color: '#666' }}>
        {props.value || 'QR Code content'}
      </div>
    </div>
  );
};
export default QRCodeWrapper; 