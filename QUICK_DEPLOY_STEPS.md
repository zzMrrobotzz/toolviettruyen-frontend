# 🚀 TRIỂN KHAI PAYMENT WRAPPER - 5 PHÚT

## ✅ BƯỚC 1: Deploy Payment Wrapper

### Option A: Railway (Khuyến nghị - Miễn phí)

1. **Tạo GitHub repo mới** cho payment wrapper:
   ```bash
   # Upload thư mục payment-wrapper/ lên GitHub repo riêng
   cd payment-wrapper/
   git init
   git add .
   git commit -m "Payment wrapper service"
   git remote add origin https://github.com/YOUR-USERNAME/viet-truyen-payment-wrapper
   git push -u origin main
   ```

2. **Deploy lên Railway:**
   - Vào [Railway.app](https://railway.app) → **New Project**
   - Chọn **Deploy from GitHub repo**
   - Chọn repo `viet-truyen-payment-wrapper`
   - Railway sẽ auto-deploy trong 2-3 phút

3. **Set Environment Variables** trong Railway:
   ```
   PAYOS_CLIENT_ID=test-client-id
   PAYOS_API_KEY=test-api-key
   PAYOS_CHECKSUM_KEY=test-checksum-key
   MAIN_BACKEND_URL=https://key-manager-backend.onrender.com/api
   FRONTEND_URL=https://your-frontend-domain.com
   NODE_ENV=production
   ```

4. **Lấy Railway URL** (ví dụ): 
   `https://viet-truyen-payment-wrapper-production-xxxx.up.railway.app`

---

## ✅ BƯỚC 2: Update Frontend Config

1. **Sửa file `config.ts`:**
   ```typescript
   const PAYMENT_WRAPPER_URL = "https://viet-truyen-payment-wrapper-production-xxxx.up.railway.app";
   ```
   
   Thay `https://viet-truyen-payment-wrapper-production-xxxx.up.railway.app` bằng URL Railway thực tế.

2. **Commit và push:**
   ```bash
   git add config.ts
   git commit -m "Update payment wrapper URL"
   git push
   ```

---

## ✅ BƯỚC 3: Test Thanh Toán Thực Tế

1. **Health Check** wrapper:
   ```bash
   curl https://your-wrapper-url.railway.app/health
   ```

2. **Test payment creation:**
   - Vào frontend → Chọn gói credit → Bấm "Nạp gói này"
   - Sẽ thấy thông tin ngân hàng thật với QR code
   - User có thể chuyển khoản thật để test

3. **Kiểm tra logs** trong Railway dashboard

---

## 🎯 TÍNH NĂNG SAU KHI DEPLOY

### ✅ Hoạt động hiện tại:
- Thử connect backend gốc trước
- Nếu fail → Dùng wrapper với PayOS/bank transfer
- Hiển thị thông tin chuyển khoản thật
- QR code thật cho mobile banking
- Payment verification (mock - sẽ có thật khi có PayOS credentials)

### 🔄 Upgrade PayOS thật:
1. Đăng ký [PayOS.vn](https://payos.vn) 
2. Lấy credentials thật
3. Update Railway environment variables
4. Thanh toán sẽ hoạt động 100% tự động

---

## 🚨 TROUBLESHOOTING

### Wrapper không hoạt động:
```bash
# Check wrapper health
curl https://your-wrapper-url.railway.app/health

# Check logs in Railway dashboard
```

### Payment fail:
- Kiểm tra Railway logs
- Verify environment variables
- Test với Postman/curl

### Frontend không connect wrapper:
- Kiểm tra `config.ts` có đúng URL không
- Check browser console cho errors
- Verify CORS settings

---

## 📞 RESULT

Sau khi hoàn thành:
- ✅ Payment wrapper running on Railway
- ✅ Frontend connect wrapper thành công  
- ✅ User thấy thông tin bank transfer thật
- ✅ QR code hoạt động với mobile banking
- ✅ Có thể thanh toán thực tế (pending PayOS setup)

**Estimated time: 5-10 phút**

Wrapper URL sẽ là: `https://viet-truyen-payment-wrapper-production-xxxx.up.railway.app`