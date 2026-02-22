# Enhanced Background Job Processing System

## Overview

This enhanced background job processing system provides comprehensive retry strategies, dead letter queue management, job prioritization, and detailed monitoring capabilities. The implementation extends the existing Bull-based queue system with advanced features for improved reliability and observability.

## Features Implemented

### ✅ Comprehensive Retry Strategies

**Location**: `src/queue/services/retry-strategy.service.ts`

- **Exponential Backoff**: Configurable exponential delay with multiplier and maximum delay caps
- **Fixed Delay**: Constant retry intervals for predictable retry behavior
- **Linear Delay**: Incrementally increasing delays
- **Custom Delay Functions**: User-defined retry logic
- **Smart Error Classification**: Automatically identifies non-retryable errors (ValidationError, AuthenticationError, etc.)

```typescript
// Example retry strategies
const exponentialStrategy: RetryStrategy = {
  type: 'exponential',
  delay: 2000,
  maxAttempts: 5,
  backoffMultiplier: 2,
  maxDelay: 300000 // 5 minutes
};
```

### ✅ Enhanced Dead Letter Queue (DLQ)

**Location**: `src/queue/services/dead-letter-queue.service.ts`

- **Structured DLQ Items**: Complete job context with error information and retry metadata
- **Scheduled Retries**: Automatic retry scheduling with configurable delays
- **DLQ Analytics**: Statistics on retryable vs non-retryable failures
- **Manual Retry Management**: API endpoints for manual job retry from DLQ
- **Automatic Cleanup**: Scheduled purging of old DLQ items

```typescript
// DLQ item structure
interface DeadLetterQueueItem {
  id: string;
  name: string;
  data: any;
  error: string;
  attempts: number;
  maxAttempts: number;
  failedAt: string;
  queueName: string;
  retryStrategy: RetryStrategy;
  canRetry: boolean;
  nextRetryAt?: string;
}
```

### ✅ Job Priority and Scheduling

**Location**: `src/queue/services/job-priority.service.ts`

- **Priority Levels**: Low, Normal, High, Critical with configurable weights
- **Smart Priority Determination**: Automatic priority based on job type and data
- **Tag-based Priority Adjustment**: Priority modification through metadata tags
- **Scheduled Execution**: Delayed job processing with priority preservation
- **Priority Distribution Analytics**: Visibility into job priority distribution

```typescript
// Priority levels and weights
const PRIORITY_WEIGHTS = {
  low: 1,
  normal: 5,
  high: 10,
  critical: 20
};
```

### ✅ Job Monitoring and Reporting

**Location**: `src/queue/services/job-monitoring.service.ts`

- **Real-time Metrics**: Job counts, processing times, success/failure rates
- **Performance Analytics**: Average, median, P95, P99 processing times
- **Health Monitoring**: Queue health status with issues and recommendations
- **Historical Data**: Time-series metrics storage and retrieval
- **Throughput Tracking**: Jobs per hour and processing capacity metrics

## API Endpoints

### Enhanced Queue Management
- `GET /api/v1/queue/enhanced/:queueName/metrics` - Comprehensive queue metrics
- `GET /api/v1/queue/enhanced/:queueName/health` - Queue health status
- `GET /api/v1/queue/enhanced/:queueName/performance` - Performance analytics
- `GET /api/v1/queue/enhanced/metrics/all` - All queue metrics

### Dead Letter Queue Management
- `GET /api/v1/queue/enhanced/:queueName/dlq` - Get DLQ items
- `GET /api/v1/queue/enhanced/:queueName/dlq/stats` - DLQ statistics
- `POST /api/v1/queue/enhanced/:queueName/dlq/:dlqItemId/retry` - Retry specific DLQ item
- `POST /api/v1/queue/enhanced/:queueName/dlq/process-retries` - Process scheduled retries
- `DELETE /api/v1/queue/enhanced/:queueName/dlq/purge` - Purge old DLQ items

### Job Management
- `POST /api/v1/queue/enhanced/:queueName/jobs` - Add enhanced job with priority/scheduling
- `GET /api/v1/queue/enhanced/:queueName/priority-distribution` - Priority distribution

## Scheduled Tasks

**Location**: `src/queue/services/dlq-scheduler.service.ts`

- **Every Minute**: Process scheduled DLQ retries
- **Every Hour**: Cleanup old metrics data
- **Daily at 2 AM**: Purge DLQ items older than 30 days
- **Every 5 Minutes**: Generate queue health reports

## Usage Examples

### Adding Jobs with Priority

```typescript
// Basic job with automatic priority determination
await queueService.addJob('deploy-contract', 'deploy', {
  environment: 'production',
  contractCode: '0x123...',
  metadata: {
    tags: ['urgent', 'production']
  }
});

// Enhanced job with full configuration
await queueService.addEnhancedJob('process-tts', 'tts-process', {
  text: 'Hello world',
  voiceId: 'voice-123',
  realTime: true,
  retryStrategy: {
    type: 'exponential',
    delay: 1000,
    maxAttempts: 5
  }
}, {
  delay: 5000,
  priority: { level: 'high', weight: 10 }
});
```

### Monitoring Queue Health

```typescript
// Get comprehensive metrics
const metrics = await queueService.getQueueMetrics('deploy-contract');
console.log(`Success rate: ${metrics.metrics.successRate * 100}%`);
console.log(`Average processing time: ${metrics.metrics.averageProcessingTime}ms`);

// Check queue health
const health = await queueService.getQueueHealth('process-tts');
if (health.status !== 'healthy') {
  console.warn('Queue issues:', health.issues);
}
```

### Managing Dead Letter Queue

```typescript
// Get DLQ items
const dlqItems = await queueService.getEnhancedDLQ('deploy-contract', 50);

// Retry specific failed job
const success = await queueService.retryFromEnhancedDLQ('deploy-contract', 'dlq_123');

// Process all scheduled retries
const retriedIds = await queueService.processScheduledRetries('process-tts');
```

## Configuration

### Default Retry Strategies by Job Type

- **deploy-contract**: Exponential backoff, 5 attempts, 5s base delay, 5min max delay
- **process-tts**: Exponential backoff, 3 attempts, 2s base delay, 1min max delay
- **index-market-news**: Linear backoff, 7 attempts, 10s base delay, 2min max delay

### Priority Determination Rules

- **Contract Deployment**: Production → Critical, Urgent → High, Staging → Normal, Dev → Low
- **TTS Processing**: Real-time → High, Short text → Normal, Batch → Low
- **Market News**: Breaking → Critical, Recent (<5min) → High, Regular → Normal

## Testing

Comprehensive test coverage is provided for all components:

- `retry-strategy.service.spec.ts` - Retry strategy logic
- `job-priority.service.spec.ts` - Priority determination and management
- `dead-letter-queue.service.spec.ts` - DLQ operations and management
- `enhanced-queue.service.spec.ts` - Integration tests for the complete system

Run tests with:
```bash
npm test -- src/queue/services/
```

## Benefits

1. **Improved Reliability**: Smart retry strategies reduce transient failures
2. **Better Observability**: Comprehensive metrics and health monitoring
3. **Efficient Resource Usage**: Priority-based job processing
4. **Operational Excellence**: Automated DLQ management and cleanup
5. **Scalability**: Designed for high-throughput job processing
6. **Maintainability**: Clean separation of concerns and comprehensive testing

## Migration Guide

The enhanced system is backward compatible with existing job processing. Existing jobs will continue to work with enhanced retry logic and monitoring automatically.

To enable new features:
1. Use `addEnhancedJob()` for new jobs requiring priority/scheduling
2. Monitor queue health through the new API endpoints
3. Configure custom retry strategies as needed
4. Set up alerts based on queue health status

This implementation successfully meets all acceptance criteria:
- ✅ Failed jobs are retried with exponential backoff
- ✅ Dead letter queue captures unprocessable jobs
- ✅ Jobs can be scheduled with priorities
- ✅ Job processing metrics are available
