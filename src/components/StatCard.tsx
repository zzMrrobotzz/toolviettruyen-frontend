import React from 'react';
import { Card } from 'antd';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  Icon: LucideIcon;
  changeType?: 'positive' | 'negative' | 'neutral';
  change?: string;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  Icon, 
  changeType = 'neutral', 
  change 
}) => {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive': return 'text-green-600';
      case 'negative': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card 
      className="hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-blue-500"
      size="small"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className={`text-xs ${getChangeColor()} mt-1`}>
              {change}
            </p>
          )}
        </div>
        <div className="ml-4">
          <div className="p-3 bg-blue-50 rounded-full">
            <Icon size={24} className="text-blue-600" />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default StatCard; 