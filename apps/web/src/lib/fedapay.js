const FEDAPAY_API_BASE_URLS = {
  live: "https://api.fedapay.com/v1",
  sandbox: "https://sandbox-api.fedapay.com/v1",
};

export class FedaPayApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "FedaPayApiError";
    this.status = status;
  }
}

export function getFedaPayConfig(env = process.env) {
  const apiKey = env.FEDAPAY_SECRET_KEY?.trim();
  const environment = env.FEDAPAY_ENVIRONMENT?.trim() || "sandbox";

  if (!apiKey) {
    throw new FedaPayApiError("FedaPay secret key is not configured", 500);
  }
  if (!Object.hasOwn(FEDAPAY_API_BASE_URLS, environment)) {
    throw new FedaPayApiError("Invalid FedaPay environment", 500);
  }

  return {
    apiKey,
    baseUrl: FEDAPAY_API_BASE_URLS[environment],
    environment,
  };
}

export function isValidFedaPayTransactionId(value) {
  return typeof value === "string" && /^[1-9]\d{0,29}$/.test(value);
}

export async function requestFedaPay(path, { method = "GET", body } = {}) {
  const { apiKey, baseUrl } = getFedaPayConfig();
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new FedaPayApiError("FedaPay request could not be completed");
  }

  if (!response.ok) {
    throw new FedaPayApiError(
      `FedaPay request failed with status ${response.status}`,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new FedaPayApiError("FedaPay returned an invalid response");
  }
}
