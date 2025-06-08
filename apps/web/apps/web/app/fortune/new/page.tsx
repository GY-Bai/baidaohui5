'use client';

import { useState, useEffect } from 'react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';
import { Checkbox } from '@kit/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { useRankWS } from '../../../lib/useRankWS';

export default function NewFortunePage() {
  const [exchangeRate, setExchangeRate] = useState<number>(7.2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    amount: 0,
    message: '',
    isUrgent: false,
    images: [] as string[],
  });
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // 使用WebSocket获取实时排名
  const { rank, isConnected } = useRankWS({
    amount: formData.amount,
    isUrgent: formData.isUrgent,
  });

  // 获取汇率
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const response = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=CNY');
        const data = await response.json();
        if (data.rates?.CNY) {
          setExchangeRate(data.rates.CNY);
        }
      } catch (error) {
        console.error('获取汇率失败:', error);
      }
    };

    fetchExchangeRate();
  }, []);

  // 表单验证
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (formData.amount <= 0) {
      newErrors.amount = '金额必须大于0';
    }
    if (formData.amount > 10000) {
      newErrors.amount = '金额不能超过10000';
    }
    if (formData.message.length > 2500) {
      newErrors.message = '附言不能超过2500字';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理图片上传
  const handleImageUpload = async (files: FileList) => {
    const uploadPromises = Array.from(files).map(async (file) => {
      // 这里应该实现图片直传R2的逻辑
      // 暂时返回模拟URL
      return `https://r2.example.com/${file.name}`;
    });

    try {
      const urls = await Promise.all(uploadPromises);
      setUploadedImages(prev => [...prev, ...urls]);
      setFormData(prev => ({ ...prev, images: [...prev.images, ...urls] }));
    } catch (error) {
      console.error('图片上传失败:', error);
    }
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/fortune/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        // 跳转到订单列表或成功页面
        window.location.href = '/fortune/queue';
      } else {
        throw new Error('提交失败');
      }
    } catch (error) {
      console.error('提交订单失败:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            新算命申请
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 金额输入 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">金额 (USD)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="请输入美元金额"
                value={formData.amount || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  amount: parseFloat(e.target.value) || 0 
                }))}
              />
              {formData.amount > 0 && (
                <p className="text-sm text-gray-600">
                  参考人民币: ¥{(formData.amount * exchangeRate).toFixed(2)}
                </p>
              )}
              {errors.amount && (
                <p className="text-sm text-red-600">{errors.amount}</p>
              )}
            </div>

            {/* 实时排名显示 */}
            {formData.amount > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-medium">
                  预估排位: {isConnected ? `第 ${rank} 位` : '计算中...'}
                </p>
              </div>
            )}

            {/* 附言 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">附言 (可选)</label>
              <Textarea
                placeholder="请输入您的问题或情况描述..."
                className="min-h-[120px]"
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  message: e.target.value 
                }))}
              />
              <p className="text-sm text-gray-500">
                {formData.message.length}/2500 字
              </p>
              {errors.message && (
                <p className="text-sm text-red-600">{errors.message}</p>
              )}
            </div>

            {/* 图片上传 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">图片上传 (可选)</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {uploadedImages.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`上传图片 ${index + 1}`}
                      className="w-full h-20 object-cover rounded"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 紧急选项 */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="urgent"
                checked={formData.isUrgent}
                onCheckedChange={(checked) => setFormData(prev => ({ 
                  ...prev, 
                  isUrgent: checked === true 
                }))}
              />
              <label htmlFor="urgent" className="text-sm font-medium text-red-600">
                小孩危急
              </label>
              <p className="text-sm text-gray-600">
                勾选此项将获得优先处理
              </p>
            </div>

            {/* 提交按钮 */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? '提交中...' : '提交申请'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 