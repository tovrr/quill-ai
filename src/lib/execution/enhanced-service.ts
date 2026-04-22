/**
 * Enhanced Execution Service
 * 
 * Extends the basic execution service with:
 * - Pre-execution validation
 * - Resource constraint enforcement
 * - Performance monitoring
 * - Security enhancement
 */

import { executeCode as executeBasic } from "./service";
import { codeValidator, ValidationResult } from "./validation";

export interface EnhancedExecutionRequest {
  code: string;
  language: string;
  timeoutMs?: number;
  validateOnly?: boolean;
  maxMemoryMB?: number;
  maxCPUPercent?: number;
  enablePerformanceTracking?: boolean;
}

export interface EnhancedExecutionResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  validation?: ValidationResult;
  performanceMetrics?: {
    memoryUsageMB?: number;
    cpuUsagePercent?: number;
    wallClockTimeMs?: number;
    executionTimeMs?: number;
  };
  error?: string;
  warnings?: string[];
  metadata?: {
    executionCount: number;
    averageExecutionTime?: number;
    successRate?: number;
    resourceViolations?: string[];
  };
}

export class EnhancedExecutionService {
  private static readonly DEFAULT_RESOURCE_LIMITS = {
    maxMemoryMB: 512,
    maxCPUPercent: 90,
    maxExecutionTimeMs: 30000,
    maxTotalExecutionCount: 100,
  };

  // Performance tracking
  private static executionCounts = new Map<string, number>();
  private static executionMetrics = new Map<string, EnhancedExecutionResult[]>();

  async execute(request: EnhancedExecutionRequest): Promise<EnhancedExecutionResult> {
    const startTime = Date.now();
    let result: EnhancedExecutionResult;

    try {
      // Pre-execution validation
      if (!request.validateOnly) {
        result = await this.executeValidated(request);
      } else {
        // Validation only mode
        const validation = codeValidator.validateCode(request.code, request.language);
        result = {
          ok: validation.isValid && validation.riskLevel !== 'critical',
          stdout: '',
          stderr: '',
          exitCode: validation.isValid ? 0 : 1,
          durationMs: Date.now() - startTime,
          validation,
          warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
        };
      }

      // Performance tracking
      if (request.enablePerformanceTracking) {
        this.recordExecutionMetrics(request.code, result);
      }

      return result;

    } catch (error) {
      result = {
        ok: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Execution failed',
      };

      return result;
    }
  }

  private async executeValidated(request: EnhancedExecutionRequest): Promise<EnhancedExecutionResult> {
    // Validate code before execution
    const validation = codeValidator.validateCode(request.code, request.language);
    
    if (!validation.isValid) {
      return {
        ok: false,
        stdout: '',
        stderr: 'Code validation failed',
        exitCode: 1,
        durationMs: 0,
        validation,
        warnings: validation.warnings,
        error: 'Validation failed: ' + validation.errors.join(', '),
      };
    }

    // Check resource constraints
    const resourceViolations = this.checkResourceConstraints(request);
    if (resourceViolations.length > 0) {
      return {
        ok: false,
        stdout: '',
        stderr: 'Resource constraint violation',
        exitCode: 1,
        durationMs: 0,
        warnings: resourceViolations,
        error: 'Resource limits exceeded',
      };
    }

    // Adjust timeout based on risk level
    const adjustedTimeout = this.adjustTimeoutBasedOnRisk(request, validation);

    // Execute with enhanced monitoring
    const startTime = Date.now();
    const executionResult = await executeBasic({
      code: request.code,
      language: request.language,
      timeoutMs: adjustedTimeout,
    });

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // Analyze execution performance
    const performanceMetrics = {
      wallClockTimeMs: durationMs,
      executionTimeMs: this.extractExecutionTime(executionResult.stdout),
    };

    // Check performance warnings
    const warnings: string[] = [];
    if (durationMs > adjustedTimeout * 0.9) {
      warnings.push('Execution took almost the entire timeout limit');
    }

    if (performanceMetrics.executionTimeMs && 
        performanceMetrics.executionTimeMs > adjustedTimeout * 0.8) {
      warnings.push('Actual execution time was close to timeout');
    }

    // Enhance result with monitoring data
    return {
      ...executionResult,
      durationMs,
      performanceMetrics,
      validation,
      warnings: warnings.length > 0 ? warnings : undefined,
      metadata: {
        executionCount: this.getUserExecutionCount(request.code),
        averageExecutionTime: this.getAverageExecutionTime(request.code),
        successRate: this.getSuccessRate(request.code),
        resourceViolations: resourceViolations,
      },
    };
  }

  private checkResourceConstraints(request: EnhancedExecutionRequest): string[] {
    const violations: string[] = [];

    // Memory constraints
    if (request.maxMemoryMB && request.maxMemoryMB > EnhancedExecutionService.DEFAULT_RESOURCE_LIMITS.maxMemoryMB) {
      violations.push(`Memory limit (${request.maxMemoryMB}MB) exceeds system limit`);
    }

    // CPU constraints
    if (request.maxCPUPercent && request.maxCPUPercent > EnhancedExecutionService.DEFAULT_RESOURCE_LIMITS.maxCPUPercent) {
      violations.push(`CPU limit (${request.maxCPUPercent}%) exceeds system limit`);
    }

    // Execution frequency
    const executionCount = this.getUserExecutionCount(request.code);
    if (executionCount >= EnhancedExecutionService.DEFAULT_RESOURCE_LIMITS.maxTotalExecutionCount) {
      violations.push('Maximum execution limit reached for this code');
    }

    return violations;
  }

  private adjustTimeoutBasedOnRisk(request: EnhancedExecutionRequest, validation: ValidationResult): number {
    const baseTimeout = request.timeoutMs || EnhancedExecutionService.DEFAULT_RESOURCE_LIMITS.maxExecutionTimeMs;
    
    switch (validation.riskLevel) {
      case 'low':
        return baseTimeout;
      case 'medium':
        return Math.min(baseTimeout * 0.8, baseTimeout);
      case 'high':
        return Math.min(baseTimeout * 0.5, baseTimeout);
      case 'critical':
        return Math.min(baseTimeout * 0.3, baseTimeout);
      default:
        return baseTimeout;
    }
  }

  private extractExecutionTime(stdout: string): number | undefined {
    // Try to extract execution time from stdout (assuming the sandbox might output timing info)
    const timeMatch = stdout.match(/(?:Time|Execution|Completed)\s*[:\-]?\s*([\d.]+)\s*(?:ms|milliseconds|seconds?)/i);
    if (timeMatch) {
      const timeValue = parseFloat(timeMatch[1]);
      return timeValue > 0 ? timeValue : undefined;
    }
    return undefined;
  }

  private getUserExecutionCount(code: string): number {
    const count = EnhancedExecutionService.executionCounts.get(code) || 0;
    EnhancedExecutionService.executionCounts.set(code, count + 1);
    return count;
  }

  private recordExecutionMetrics(code: string, result: EnhancedExecutionResult): void {
    if (!EnhancedExecutionService.executionMetrics.has(code)) {
      EnhancedExecutionService.executionMetrics.set(code, []);
    }
    
    const metrics = EnhancedExecutionService.executionMetrics.get(code)!;
    metrics.push(result);
    
    // Keep only last 100 executions
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  private getAverageExecutionTime(code: string): number | undefined {
    const metrics = EnhancedExecutionService.executionMetrics.get(code) || [];
    if (metrics.length === 0) return undefined;
    
    const totalTime = metrics
      .filter(m => m.ok)
      .reduce((sum, m) => sum + (m.durationMs || 0), 0);
    
    return totalTime / metrics.length;
  }

  private getSuccessRate(code: string): number | undefined {
    const metrics = EnhancedExecutionService.executionMetrics.get(code) || [];
    if (metrics.length === 0) return undefined;
    
    const successfulExecutions = metrics.filter(m => m.ok).length;
    return successfulExecutions / metrics.length;
  }

  // Static utility methods for performance monitoring
  static getExecutionStats(code: string): {
    count: number;
    averageExecutionTime?: number;
    successRate?: number;
    recentResults: EnhancedExecutionResult[];
  } {
    const count = this.executionCounts.get(code) || 0;
    const metrics = this.executionMetrics.get(code) || [];
    const successfulExecutions = metrics.filter(m => m.ok).length;
    
    return {
      count,
      averageExecutionTime: count > 0 ? 
        metrics.reduce((sum, m) => sum + (m.durationMs || 0), 0) / count : undefined,
      successRate: count > 0 ? successfulExecutions / count : undefined,
      recentResults: metrics.slice(-10), // Last 10 results
    };
  }

  static resetExecutionStats(code?: string): void {
    if (code) {
      this.executionCounts.delete(code);
      this.executionMetrics.delete(code);
    } else {
      this.executionCounts.clear();
      this.executionMetrics.clear();
    }
  }
}

export const enhancedExecutionService = new EnhancedExecutionService();
