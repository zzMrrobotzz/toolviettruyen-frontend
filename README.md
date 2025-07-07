# AI Story Writing Tool

Công cụ viết truyện AI - Desktop Application

## 🚀 Tính năng

- **Viết truyện AI**: Tạo nội dung truyện với AI
- **Chỉnh sửa truyện**: Cải thiện và chỉnh sửa nội dung
- **Phân tích**: Phân tích và đánh giá truyện
- **Tạo nhân vật**: Studio tạo nhân vật
- **Lab sáng tạo**: Công cụ sáng tạo nội dung
- **SEO YouTube**: Tối ưu cho YouTube
- **Tạo hình ảnh**: Tạo hình ảnh minh họa
- **Text-to-Speech**: Chuyển văn bản thành giọng nói
- **Nạp credit**: Hệ thống thanh toán PayOS

## 📦 Cài đặt

### Desktop App (Windows)
1. Tải file `AI Story Writing Tool Setup 1.0.0.exe` từ thư mục `release/`
2. Chạy file installer
3. Làm theo hướng dẫn cài đặt

### Web App
Truy cập: [URL Netlify của bạn]

## 🛠️ Phát triển

### Yêu cầu
- Node.js 18+
- npm hoặc yarn

### Cài đặt dependencies
```bash
npm install
```

### Chạy development
```bash
npm run dev
```

### Build desktop app
```bash
npm run build
npm run dist
```

### Build tự động
```bash
.\build-release.ps1
```

## 🏗️ Kiến trúc

- **Frontend**: React + TypeScript + Vite
- **Desktop**: Electron
- **Backend**: Node.js + Express (deploy trên Render)
- **Database**: MongoDB Atlas
- **Payment**: PayOS

## 📁 Cấu trúc project

```
├── components/          # React components
│   ├── modules/        # Các module chức năng
│   └── ...
├── services/           # API services
├── assets/            # Icons và resources
├── dist/              # Build output
├── release/           # Desktop app installer
└── ...
```

## 🔧 Cấu hình

### API Settings
Cấu hình API keys trong `constants.ts`:
- OpenAI
- Google Gemini
- DeepSeek
- Stability AI
- ElevenLabs

### Backend URL
Cập nhật backend URL trong `constants.ts`:
```typescript
export const BACKEND_URL = 'https://your-backend.onrender.com';
```

## 📝 License

[Your License]

## 🤝 Đóng góp

[Your contribution guidelines]
