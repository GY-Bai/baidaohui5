'use client';

import { useState, useEffect, useRef } from 'react';

interface UseRankWSProps {
  amount: number;
  isUrgent: boolean;
}

interface UseRankWSReturn {
  rank: number;
  isConnected: boolean;
}

export function useRankWS({ amount, isUrgent }: UseRankWSProps): UseRankWSReturn {
  const [rank, setRank] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 只有当金额大于0时才获取排名
    if (amount <= 0) {
      setRank(0);
      setIsConnected(false);
      return;
    }

    // 防抖：延迟获取排名，避免频繁请求
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      fetchRank();
    }, 500);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [amount, isUrgent]);

  const fetchRank = async () => {
    try {
      setIsConnected(true);
      
      const response = await fetch(
        `http://localhost:3001/fortune/rank?amount=${amount}&is_urgent=${isUrgent}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setRank(data.rank || 0);
      } else {
        console.error('获取排名失败:', response.statusText);
        setRank(0);
      }
    } catch (error) {
      console.error('获取排名失败:', error);
      setRank(0);
      setIsConnected(false);
    }
  };

  return {
    rank,
    isConnected,
  };
} 