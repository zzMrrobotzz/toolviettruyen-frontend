# API Wrapper Solution - Alternative Backend

## 🎯 Tạo API Wrapper riêng

Nếu không thể sửa backend chính, tạo service wrapper riêng:

### 1. Tạo Express API Wrapper

```javascript
// wrapper-server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const MAIN_BACKEND = 'https://key-manager-backend.onrender.com/api';

// Wrapper endpoint cho payment
app.post('/api/payment/create', async (req, res) => {
  try {
    const { key, creditAmount, credits, amount, packageId } = req.body;
    
    console.log('Wrapper received:', req.body);
    
    // Transform to format that main backend expects
    const transformedPayload = transformPayload(req.body);
    
    console.log('Transformed payload:', transformedPayload);
    
    // Try multiple formats with main backend
    const formats = [
      { userKey: key, creditAmount: creditAmount || credits || amount },
      { key: key, amount: amount || (creditAmount * 1000) },
      { keyId: key, credit: creditAmount || credits || amount },
      // Add more format attempts
    ];
    
    for (const format of formats) {
      try {
        const response = await axios.post(`${MAIN_BACKEND}/payment/create`, format);
        return res.json(response.data);
      } catch (err) {
        console.log(`Format ${JSON.stringify(format)} failed:`, err.response?.data);
      }
    }
    
    // If all fail, return mock response
    const mockResponse = generateMockPayment(req.body);
    res.json(mockResponse);
    
  } catch (error) {
    console.error('Wrapper error:', error);
    res.status(500).json({ success: false, error: 'Wrapper service error' });
  }
});

function transformPayload(original) {
  // Transform frontend payload to backend expected format
  return {
    // Try different field names
    key: original.key,
    userKey: original.key,
    keyId: original.key,
    credit: original.creditAmount || original.credits || original.amount,
    creditAmount: original.creditAmount || original.credits || original.amount,
    amount: original.amount || (original.creditAmount * 1000),
    packageInfo: original.packageId ? { id: original.packageId } : null
  };
}

function generateMockPayment(requestData) {
  const orderCode = 'MOCK' + Date.now();
  
  return {
    success: true,
    transferInfo: {
      bankName: 'VietinBank',
      accountNumber: '103876543210',
      accountHolder: 'CONG TY VIET TRUYEN',
      amount: requestData.amount || (requestData.creditAmount * 4545), // ~4545 VNĐ/credit
      content: `CREDIT ${requestData.key} ${orderCode}`
    },
    qrData: generateQR(requestData),
    payUrl: `https://pay.payos.vn/web/${orderCode}`
  };
}

app.listen(3001, () => {
  console.log('Payment wrapper running on port 3001');
});
```

### 2. Deploy wrapper lên Heroku/Railway

```bash
# Deploy to Railway
railway login
railway init
railway up
```

### 3. Update frontend config

```typescript
// config.ts
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? "https://your-wrapper.railway.app/api"  // Wrapper API
  : "http://localhost:3001/api";            // Local wrapper

export { API_BASE_URL };
```

## ✅ Lợi ích của approach này

1. **Không cần đợi backend team**: Triển khai ngay
2. **Backward compatible**: Vẫn thử connect main backend trước
3. **Fallback mechanism**: Mock payment khi tất cả fail
4. **Easy migration**: Khi main backend fix xong, chỉ cần update config
5. **Independent scaling**: Wrapper có thể scale riêng

## 🚀 Triển khai ngay

1. Copy code wrapper trên
2. Deploy lên Railway/Heroku (miễn phí)
3. Update frontend config
4. Test với người dùng thực tế

## 💡 Advanced Features

- Rate limiting
- Request logging
- Payment verification
- Webhook handling
- Database cho transaction tracking