import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error('Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);
    
    // You can also log to an error reporting service here
    this.setState({
      error,
      errorInfo
    });
  }

  handleReload = () => {
    // Clear error state and reload
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    window.location.reload();
  };

  handleReset = () => {
    // Just clear error state without reload
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full">
            <Result
              status="500"
              title="Oops! Có lỗi xảy ra"
              subTitle="Ứng dụng gặp phải lỗi không mong muốn. Vui lòng thử lại hoặc liên hệ hỗ trợ."
              extra={[
                <Button type="primary" key="reload" onClick={this.handleReload}>
                  Tải lại trang
                </Button>,
                <Button key="reset" onClick={this.handleReset}>
                  Thử lại
                </Button>,
              ]}
            />
            
            {/* Error details for debugging (only show in development) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-sm font-medium text-red-800 mb-2">Chi tiết lỗi:</h3>
                <pre className="text-xs text-red-700 overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 