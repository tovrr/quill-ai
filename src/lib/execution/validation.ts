/**
 * Enhanced Execution Sandbox Validation
 *
 * Comprehensive validation system for code execution safety:
 * - Pre-execution code analysis
 * - Resource constraint enforcement
 * - Security vulnerability scanning
 * - Performance optimization validation
 * - Execution pattern analysis
 */

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
  metadata?: {
    codeSize?: number;
    complexity?: number;
    bannedWords?: string[];
    securityIssues?: SecurityIssue[];
  };
}

export interface SecurityIssue {
  type: "os_command" | "network_request" | "file_access" | "data_access" | "resource_hog";
  severity: "warning" | "error" | "critical";
  description: string;
  line?: number;
  suggestion?: string;
}

export class CodeValidator {
  // banned patterns for security
  private readonly BANNED_PATTERNS = {
    os_commands: [
      /os\.system\(/i,
      /subprocess\(/i,
      /exec\(/i,
      /spawn\(/i,
      /os\.popen\(/i,
      /shutil\.rmtree/i,
      /os\.remove/i,
      /os\.unlink/i,
    ],
    network_requests: [
      /requests\.(get|post|put|delete|patch)/i,
      /urllib\.(request|open)/i,
      /http\.client/i,
      /socket\.socket/i,
      /curl/i,
      /fetch\(.*localhost.*\)/i,
      /axios\.get/i,
    ],
    file_access: [/open\(.*['"]\/.*['"]\)/i, /open\(.*['~'].*['"]\)/i, /os\.path\.expanduser/i, /pathlib\.Path/i],
    resource_hog: [
      /time\.sleep\(\s*[0-9]+\s*\)/i,
      /while\s+True:/i,
      /for\s+\s*in\s+range\(\s*[0-9]{5,}\s*\)/i,
      /(list|set|dict)\(\s*range\(\s*[0-9]{5,}\s*\)\s*\)/i,
    ],
  };

  // code complexity analysis
  private readonly COMPLEXITY_PATTERNS = {
    deep_nesting: /(?:\s{4,}|\t)/g,
    function_calls: /(?<!\w)\w+\s*\(/g,
    loops: /(while\s+\w+|for\s+\w+\s+in\s+\w+)/g,
    // Capture function name and use [\s\S] instead of dotAll for broader compatibility
    recursion: /(?:def\s+(\w+)\([^)]*\):\s*[\s\S]*?\1\w+|return\s+\w+\([^)]*\))/g,
  };

  // resource limits
  private readonly RESOURCE_LIMITS = {
    maxLines: 1000,
    maxCodeSize: 50000, // 50KB
    maxComplexity: 10,
    maxNestingDepth: 5,
    maxFunctionCalls: 100,
  };

  validateCode(code: string, language: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      riskLevel: "low",
      metadata: {
        codeSize: 0,
        complexity: 0,
        bannedWords: [],
        securityIssues: [],
      },
    };

    // Basic validation
    result.isValid = this.validateBasic(code, result);

    if (!result.isValid) {
      return result;
    }

    // Security validation
    this.validateSecurity(code, result);

    // Complexity analysis
    this.validateComplexity(code, result);

    // Resource constraints
    this.validateResources(code, result);

    // Language-specific checks
    this.validateLanguageSpecific(code, language, result);

    // Set final risk level
    result.riskLevel = this.calculateRiskLevel(result);

    return result;
  }

  private validateBasic(code: string, result: ValidationResult): boolean {
    // Check for empty code
    if (!code || code.trim().length === 0) {
      result.errors.push("Code cannot be empty");
      return false;
    }

    // Check code size
    const codeLength = code.length;
    if (codeLength > this.RESOURCE_LIMITS.maxCodeSize) {
      result.errors.push(`Code size (${codeLength}) exceeds limit (${this.RESOURCE_LIMITS.maxCodeSize})`);
      return false;
    }
    result.metadata!.codeSize = codeLength;

    // Check line count
    const lineCount = code.split("\n").length;
    if (lineCount > this.RESOURCE_LIMITS.maxLines) {
      result.warnings.push(`Code has many lines (${lineCount}). Consider refactoring.`);
    }

    // Check for obvious security issues
    if (code.includes("<script>") || code.includes("</script>")) {
      result.errors.push("Potential security issue: JavaScript injection detected");
      return false;
    }

    if (code.includes("eval(") || code.includes("exec(")) {
      result.errors.push("Potential security issue: Dynamic code execution detected");
      return false;
    }

    return true;
  }

  private validateSecurity(code: string, result: ValidationResult): void {
    let securityIssues: SecurityIssue[] = [];

    // Check OS command injection
    const osCommandMatches = this.findPatternMatches(this.BANNED_PATTERNS.os_commands, code);
    if (osCommandMatches.length > 0) {
      securityIssues.push({
        type: "os_command",
        severity: "critical",
        description: "Potential OS command injection detected",
        suggestion: "Use safe libraries instead of executing OS commands",
      });
    }

    // Check network requests
    const networkMatches = this.findPatternMatches(this.BANNED_PATTERNS.network_requests, code);
    if (networkMatches.length > 0) {
      securityIssues.push({
        type: "network_request",
        severity: "error",
        description: "Network requests are not allowed in this environment",
        suggestion: "Use provided APIs instead for external communication",
      });
    }

    // Check file system access
    const fileMatches = this.findPatternMatches(this.BANNED_PATTERNS.file_access, code);
    if (fileMatches.length > 0) {
      securityIssues.push({
        type: "file_access",
        severity: "warning",
        description: "File system access is restricted",
        suggestion: "Use safe file operations or memory-based operations",
      });
    }

    // Check for potential resource hogs
    const resourceMatches = this.findPatternMatches(this.BANNED_PATTERNS.resource_hog, code);
    if (resourceMatches.length > 0) {
      resourceMatches.forEach((match) => {
        securityIssues.push({
          type: "resource_hog",
          severity: "warning",
          description: "Potential resource-intensive operation detected",
          suggestion: "Optimize loops or use appropriate timeouts",
        });
      });
    }

    result.metadata!.securityIssues = securityIssues;
    result.warnings.push(
      ...securityIssues.filter((issue) => issue.severity === "warning").map((issue) => issue.description),
    );
    result.errors.push(
      ...securityIssues
        .filter((issue) => issue.severity === "critical")
        .map((issue) => `${issue.severity.toUpperCase()}: ${issue.description}`),
    );
  }

  private validateComplexity(code: string, result: ValidationResult): void {
    let complexity = 0;

    // Analyze nesting depth
    const lines = code.split("\n");
    let maxNesting = 0;
    let currentNesting = 0;

    for (const line of lines) {
      if (line.includes("if ") || line.includes("for ") || line.includes("while ") || line.includes("try:")) {
        currentNesting += 1;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (line.trim() === "" || line.includes("#")) {
        continue;
      } else {
        currentNesting = 0;
      }
    }

    if (maxNesting > this.RESOURCE_LIMITS.maxNestingDepth) {
      result.warnings.push(`Deep nesting detected (${maxNesting} levels)`);
    }
    complexity += maxNesting;

    // Count function calls
    const functionCallMatches = (code.match(this.COMPLEXITY_PATTERNS.function_calls) || []).length;
    if (functionCallMatches > this.RESOURCE_LIMITS.maxFunctionCalls) {
      result.warnings.push(`High number of function calls (${functionCallMatches})`);
    }
    complexity += Math.min(functionCallMatches / 10, 5);

    // Check for recursion
    if (this.COMPLEXITY_PATTERNS.recursion.test(code)) {
      result.warnings.push("Recursive code detected - may impact performance");
      complexity += 3;
    }

    result.metadata!.complexity = Math.round(complexity);
    if (complexity > this.RESOURCE_LIMITS.maxComplexity) {
      result.warnings.push("Code complexity is high - consider refactoring");
    }
  }

  private validateResources(code: string, result: ValidationResult): void {
    // Check for potential memory issues
    if (code.includes("list(range(") || code.includes("set(range(")) {
      const listMatches = code.match(/list\(range\((\d+)\)\)/g);
      if (listMatches) {
        for (const match of listMatches) {
          const number = match.match(/\d+/)?.[0];
          if (number && parseInt(number) > 10000) {
            result.errors.push(`Potential memory issue: Large list creation detected with ${number} elements`);
          }
        }
      }
    }
  }

  private validateLanguageSpecific(code: string, language: string, result: ValidationResult): void {
    switch (language.toLowerCase()) {
      case "python":
        // Python-specific checks
        if (code.includes("import ") && (code.includes("subprocess") || code.includes("os"))) {
          result.errors.push("Suspicious imports detected");
        }
        break;
      case "javascript":
        // JavaScript-specific checks
        if (code.includes("import(") || code.includes("require(")) {
          result.errors.push("Module imports are not allowed in this environment");
        }
        break;
      default:
        // Generic checks for other languages
        break;
    }
  }

  private calculateRiskLevel(result: ValidationResult): "low" | "medium" | "high" | "critical" {
    if (result.errors.length > 0) return "critical";
    if (result.warnings.length > 5) return "high";
    if (result.warnings.length > 2) return "medium";
    return "low";
  }

  private findPatternMatches(patterns: RegExp[], code: string): string[] {
    const matches: string[] = [];
    for (const pattern of patterns) {
      const found = code.match(pattern);
      if (found) {
        matches.push(...found);
      }
    }
    return matches;
  }
}

export const codeValidator = new CodeValidator();
