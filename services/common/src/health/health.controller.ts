import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

interface HealthCheckRequest {
  service?: string;
}

interface HealthCheckResponse {
  status: 'SERVING' | 'NOT_SERVING' | 'UNKNOWN';
}

@Controller()
export class HealthController {
  @GrpcMethod('Health', 'Check')
  check(_data: HealthCheckRequest): HealthCheckResponse {
    // 简单的健康检查实现
    // 在实际应用中，这里可以检查数据库连接、外部服务等
    return {
      status: 'SERVING',
    };
  }

  @GrpcMethod('Health', 'Watch')
  watch(_data: HealthCheckRequest) {
    // 流式健康检查实现
    // 这里可以返回一个 Observable 来持续监控服务状态
    return {
      status: 'SERVING',
    };
  }
} 