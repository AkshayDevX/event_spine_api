import {
  FilterConfig,
  HttpRequestConfig,
  Payload,
  StepConfig,
} from "./workflow.schema";

export class FilterFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FilterFailedError";
  }
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
  const { url, method = "POST", headers = {} } = config;

  if (!url) throw new Error("HTTP Request requires a 'url' in config");

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: ["POST", "PUT", "PATCH"].includes(method.toUpperCase())
      ? JSON.stringify(payload)
      : undefined,
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

  return {
    status: response.status,
    response: responseBody,
  };
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
