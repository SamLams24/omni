import axios from "axios";
import { FedaPay, Requestor, Transaction } from "fedapay";

const FEDAPAY_API_BASE_URLS = {
  live: "https://api.fedapay.com/v1",
  sandbox: "https://sandbox-api.fedapay.com/v1",
};

Requestor.setHttpClient(axios.create({ timeout: 8000 }));

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

function configureFedaPay() {
  const config = getFedaPayConfig();
  FedaPay.setApiKey(config.apiKey);
  FedaPay.setEnvironment(config.environment);
  return config;
}

async function runFedaPayRequest(request) {
  try {
    configureFedaPay();
    return await request();
  } catch (error) {
    if (error instanceof FedaPayApiError) throw error;
    throw new FedaPayApiError("FedaPay request could not be completed");
  }
}

export function createFedaPayTransaction(params) {
  return runFedaPayRequest(() => Transaction.create(params));
}

export function retrieveFedaPayTransaction(transactionId) {
  return runFedaPayRequest(() => Transaction.retrieve(transactionId));
}
