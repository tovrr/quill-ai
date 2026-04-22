import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { enhancedExecutionService } from "@/lib/execution/enhanced-service";
import { codeValidator } from "@/lib/execution/validation";
import { isExecutionAvailable, SUPPORTED_LANGUAGES } from "@/lib/execution/service";

export const maxDuration = 35;

function jsonResponse(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  // Enhanced authentication and security checks
  let userId: string;
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      return jsonResponse({ error: "Authentication required to execute code." }, 401);
    }
    userId = session.user.id;
  } catch {
    return jsonResponse({ error: "Authentication required to execute code." }, 401);
  }

  if (!isExecutionAvailable()) {
    return jsonResponse({ error: "Code execution sandbox is not enabled on this server." }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  // Enhanced input validation
  const { code, language, timeoutMs, validateOnly = false, enablePerformanceTracking = false } = body;

  if (typeof code !== 'string' || !code.trim()) {
    return jsonResponse({ error: "Missing or empty 'code' field." }, 400);
  }

  if (typeof language !== 'string') {
    return jsonResponse({ error: "Missing 'language' field." }, 400);
  }

  if (!SUPPORTED_LANGUAGES.includes(language.toLowerCase())) {
    return jsonResponse(
      { error: `Unsupported language '${language}'. Supported: ${SUPPORTED_LANGUAGES.join(", ")}` },
      400,
    );
  }

  // Enhanced validation only mode
  if (validateOnly) {
    const validation = codeValidator.validateCode(code, language);
    
    console.info("[sandbox/enhanced-execute:validate]", {
      userId,
      language,
      isValid: validation.isValid,
      riskLevel: validation.riskLevel,
      warningsCount: validation.warnings.length,
      errorsCount: validation.errors.length,
    });

    return jsonResponse(
      {
        isValid: validation.isValid,
        validation,
        riskLevel: validation.riskLevel,
        warnings: validation.warnings,
        errors: validation.errors,
        canExecute: validation.isValid && validation.riskLevel !== 'critical',
      },
      validation.isValid ? 200 : 422,
    );
  }

  // Execute with enhanced monitoring
  try {
    const result = await enhancedExecutionService.execute({
      code,
      language: language.toLowerCase(),
      timeoutMs: typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : undefined,
      enablePerformanceTracking,
    });

    // Log enhanced metrics
    console.info("[sandbox/enhanced-execute]", {
      userId,
      language,
      ok: result.ok,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      riskLevel: result.validation?.riskLevel,
      hasValidation: !!result.validation,
      hasPerformanceMetrics: !!result.performanceMetrics,
      warningsCount: result.warnings?.length || 0,
      error: result.error ?? null,
    });

    // Prepare response with enhanced data
    const responseData: Record<string, unknown> = {
      ok: result.ok,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
    };

    // Add validation data if available
    if (result.validation) {
      responseData.validation = result.validation;
      responseData.riskLevel = result.validation.riskLevel;
      responseData.canExecute = result.validation.isValid && result.validation.riskLevel !== 'critical';
    }

    // Add warnings if any
    if (result.warnings && result.warnings.length > 0) {
      responseData.warnings = result.warnings;
    }

    // Add error if available
    if (result.error) {
      responseData.error = result.error;
    }

    // Add performance metrics if enabled and available
    if (enablePerformanceTracking && result.performanceMetrics) {
      responseData.performanceMetrics = result.performanceMetrics;
    }

    // Add metadata for monitoring
    if (result.metadata) {
      responseData.metadata = result.metadata;
    }

    return jsonResponse(responseData, result.ok ? 200 : 422);

  } catch (error) {
    console.error("[sandbox/enhanced-execute:error]", {
      userId,
      language,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return jsonResponse(
      {
        ok: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Code execution failed',
        exitCode: 1,
        durationMs: 0,
        error: error instanceof Error ? error.message : 'Execution error',
        canExecute: false,
      },
      500,
    );
  }
}

export async function GET(req: Request) {
  // Provide information about enhanced execution capabilities
  const url = new URL(req.url);
  const language = url.searchParams.get('language');

  if (language) {
    const validation = codeValidator.validateCode('# Sample placeholder code', language);
    
    return jsonResponse({
      language,
      supportsValidation: true,
      supportedFeatures: [
        'pre-execution validation',
        'risk assessment',
        'performance monitoring',
        'resource constraint enforcement',
        'security scanning'
      ],
      resourceLimits: {
        maxCodeSize: 50000,
        maxLines: 1000,
        maxComplexity: 10,
        maxNestingDepth: 5,
        maxExecutionTimeMs: 30000,
      },
      sampleRiskLevels: ['low', 'medium', 'high', 'critical'],
      validationExample: validation,
    }, 200);
  }

  return jsonResponse({
    endpoint: 'enhanced-execute',
    description: 'Enhanced code execution with validation and monitoring',
    features: [
      'pre-execution code validation',
      'security vulnerability scanning', 
      'performance monitoring',
      'resource constraint enforcement',
      'risk assessment',
      'execution statistics tracking',
    ],
    supportedLanguages: SUPPORTED_LANGUAGES,
    resourceLimits: {
      maxCodeSize: '50KB',
      maxLines: 1000,
      maxExecutionTime: '30 seconds',
      maxNestingDepth: 5,
    },
    endpoints: {
      POST: {
        description: 'Execute code with enhanced validation',
        parameters: {
          code: 'string - Code to execute',
          language: 'string - Programming language',
          timeoutMs: 'number - Execution timeout in milliseconds',
          validateOnly: 'boolean - Only validate without execution',
          enablePerformanceTracking: 'boolean - Enable detailed performance monitoring',
        },
        response: {
          ok: 'boolean - Execution success status',
          stdout: 'string - Standard output',
          stderr: 'string - Standard error',
          exitCode: 'number - Exit code',
          durationMs: 'number - Execution duration',
          validation: 'object - Pre-execution validation results',
          warnings: 'string[] - Warning messages',
          performanceMetrics: 'object - Performance monitoring data',
        },
      },
      GET: {
        description: 'Get enhanced execution capabilities information',
        parameters: {
          language: 'string - Get validation info for specific language',
        },
      },
    },
  }, 200);
}
