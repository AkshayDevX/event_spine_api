import {
  FilterConfig,
  HttpRequestConfig,
  Payload,
  StepConfig,
} from "./workflow.schema";
import { env } from "../../config/env";

export class FilterFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FilterFailedError";
  }
}

class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

type CircuitState = {
  failures: number;
  openedAt?: number;
};

const httpCircuitStates = new Map<string, CircuitState>();

function getCircuitKey(config: HttpRequestConfig) {
  return `${(config.method ?? "POST").toUpperCase()} ${config.url}`;
}

function assertCircuitAllowsRequest(key: string) {
  const state = httpCircuitStates.get(key);
  if (!state?.openedAt) return;

  const elapsed = Date.now() - state.openedAt;
  if (elapsed < env.HTTP_CIRCUIT_RESET_TIMEOUT_MS) {
    throw new CircuitBreakerOpenError(
      `Circuit breaker open for ${key}; downstream is temporarily disabled`,
    );
  }
}

function recordCircuitSuccess(key: string) {
  httpCircuitStates.delete(key);
}

function recordCircuitFailure(key: string) {
  const current = httpCircuitStates.get(key) ?? { failures: 0 };
  const failures = current.failures + 1;
  httpCircuitStates.set(key, {
    failures,
    openedAt:
      failures >= env.HTTP_CIRCUIT_FAILURE_THRESHOLD
        ? Date.now()
        : current.openedAt,
  });
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  if (!obj || !path) return undefined;
  return path
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc !== null && acc !== undefined
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      obj,
    );
}

async function handleHttpRequest(config: HttpRequestConfig, payload: Payload) {
  const { url, method = "POST", headers = {}, body: customBody } = config;

  if (!url) throw new Error("HTTP Request requires a 'url' in config");
  const circuitKey = getCircuitKey(config);
  assertCircuitAllowsRequest(circuitKey);

  let finalBody: string | undefined = undefined;
  if (["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
    if (customBody) {
      finalBody = typeof customBody === "string" ? customBody : JSON.stringify(customBody);
    } else {
      finalBody = JSON.stringify(payload);
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: finalBody,
    });

    const responseText = await response.text();
    let responseBody: unknown;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }

    if (!response.ok) {
      throw new Error(
        `HTTP Request failed with status ${response.status}: ${JSON.stringify(
          responseBody,
        )}`,
      );
    }

    recordCircuitSuccess(circuitKey);
    return {
      status: response.status,
      response: responseBody,
    };
  } catch (err: unknown) {
    recordCircuitFailure(circuitKey);
    throw err;
  }
}

async function handleFilter(config: FilterConfig, payload: Payload) {
  const { key, operator, value } = config;

  if (!key || !operator) {
    throw new Error("Filter requires 'key' and 'operator' in config");
  }

  const actualValue = getNestedValue(payload, key);

  const evaluateFilter = (): boolean => {
    switch (operator) {
      case "equals":
        return actualValue === value;
      case "not_equals":
        return actualValue !== value;
      case "contains":
        return String(actualValue).includes(String(value));
      case "exists":
        return actualValue !== undefined && actualValue !== null;
      default:
        throw new Error(`Unknown filter operator: ${operator}`);
    }
  };

  const passed = evaluateFilter();

  if (!passed) {
    throw new FilterFailedError(
      `Payload field '${key}' (${actualValue}) did not pass filter '${operator} ${value}'`,
    );
  }

  return {
    filter_passed: true,
    message: `Payload matched filter: ${key} ${operator} ${value ?? ""}`,
  };
}

export async function executeStep(
  actionType: string,
  config: StepConfig,
  payload: Payload,
) {
  switch (actionType) {
    case "http_request":
      return await handleHttpRequest(config as HttpRequestConfig, payload);
    case "filter":
      return await handleFilter(config as FilterConfig, payload);
    default:
      throw new Error(`Unsupported actionType: ${actionType}`);
  }
}
