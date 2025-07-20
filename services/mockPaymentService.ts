/**
 * Mock Payment Service - Temporary solution until backend API is fixed
 * This service simulates PayOS payment creation with real-looking data
 */

export interface MockTransferInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
  content: string;
  qrCode: string;
}

export interface MockPaymentResponse {
  success: boolean;
  transferInfo: MockTransferInfo;
  qrData: string;
  payUrl: string;
  orderCode: string;
}

export interface CreditPackage {
  _id: string;
  name: string;
  price: number;
  credits: number;
  bonus?: string;
  isPopular?: boolean;
  isActive?: boolean;
}

class MockPaymentService {
  private generateOrderCode(): string {
    return 'ORD' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
  }

  private generateQRData(transferInfo: MockTransferInfo): string {
    // Generate realistic banking QR format
    const qrData = `00020101021238580010A00000072701270006970455012347896666541500${transferInfo.amount}.006303VND5409${transferInfo.content}62070503***6304`;
    return qrData + this.calculateChecksum(qrData);
  }

  private calculateChecksum(data: string): string {
    // Simple checksum for demo
    return (data.length % 1000).toString().padStart(4, '0');
  }

  private generatePayOSUrl(orderCode: string): string {
    return `https://pay.payos.vn/web/${orderCode}`;
  }

  private getBankAccountForAmount(amount: number): { accountNumber: string; accountHolder: string; bankName: string } {
    // Different accounts for different amounts to simulate real system
    if (amount >= 3000000) {
      return {
        accountNumber: '97045501234789',
        accountHolder: 'CONG TY TNHH VIET TRUYEN',
        bankName: 'Techcombank'
      };
    } else if (amount >= 1000000) {
      return {
        accountNumber: '19045501234567', 
        accountHolder: 'VIET TRUYEN PLATFORM',
        bankName: 'VPBank'
      };
    } else {
      return {
        accountNumber: '12345678901234',
        accountHolder: 'DICH VU VIET TRUYEN',
        bankName: 'MB Bank'
      };
    }
  }

  async createPayment(userKey: string, pkg: CreditPackage): Promise<MockPaymentResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const orderCode = this.generateOrderCode();
    const bankInfo = this.getBankAccountForAmount(pkg.price);
    const content = `CREDIT ${userKey} ${orderCode}`;

    const transferInfo: MockTransferInfo = {
      bankName: bankInfo.bankName,
      accountNumber: bankInfo.accountNumber,
      accountHolder: bankInfo.accountHolder,
      amount: pkg.price,
      content: content,
      qrCode: ''
    };

    // Generate QR code after having transfer info
    transferInfo.qrCode = this.generateQRData(transferInfo);

    const response: MockPaymentResponse = {
      success: true,
      transferInfo,
      qrData: transferInfo.qrCode,
      payUrl: this.generatePayOSUrl(orderCode),
      orderCode
    };

    // Store in localStorage for payment verification
    this.storePendingPayment(userKey, pkg, orderCode);

    console.log('Mock payment created:', response);
    return response;
  }

  private storePendingPayment(userKey: string, pkg: CreditPackage, orderCode: string): void {
    const pendingPayments = JSON.parse(localStorage.getItem('pendingPayments') || '[]');
    
    pendingPayments.push({
      userKey,
      package: pkg,
      orderCode,
      createdAt: new Date().toISOString(),
      status: 'pending'
    });

    localStorage.setItem('pendingPayments', JSON.stringify(pendingPayments));
  }

  async verifyPayment(orderCode: string): Promise<{ success: boolean; message: string }> {
    // Simulate payment verification
    await new Promise(resolve => setTimeout(resolve, 1500));

    const pendingPayments = JSON.parse(localStorage.getItem('pendingPayments') || '[]');
    const paymentIndex = pendingPayments.findIndex((p: any) => p.orderCode === orderCode);

    if (paymentIndex === -1) {
      return { success: false, message: 'Không tìm thấy đơn thanh toán' };
    }

    const payment = pendingPayments[paymentIndex];
    const now = new Date();
    const createdAt = new Date(payment.createdAt);
    const timeDiff = now.getTime() - createdAt.getTime();

    // Simulate 70% success rate after 3 minutes
    if (timeDiff > 180000 && Math.random() > 0.3) {
      // Mark as completed
      pendingPayments[paymentIndex].status = 'completed';
      pendingPayments[paymentIndex].completedAt = now.toISOString();
      localStorage.setItem('pendingPayments', JSON.stringify(pendingPayments));

      return { 
        success: true, 
        message: `Thanh toán thành công! ${payment.package.credits} credits đã được cộng vào tài khoản.` 
      };
    }

    return { 
      success: false, 
      message: 'Thanh toán chưa được xác nhận. Vui lòng thử lại sau ít phút.' 
    };
  }

  getPendingPayments(userKey: string): any[] {
    const pendingPayments = JSON.parse(localStorage.getItem('pendingPayments') || '[]');
    return pendingPayments.filter((p: any) => p.userKey === userKey && p.status === 'pending');
  }
}

export const mockPaymentService = new MockPaymentService();