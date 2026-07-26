export class CatalogInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "CatalogInputError";
    this.status = status;
  }
}

export async function readCatalogRequest(request, parser) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new CatalogInputError("Invalid JSON body");
  }
  return parser(body);
}

function requiredText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw new CatalogInputError(`${field} is required`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new CatalogInputError(
      `${field} must contain at most ${maxLength} characters`,
    );
  }
  return normalized;
}

function optionalText(value, field, maxLength) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new CatalogInputError(`${field} must be text`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new CatalogInputError(
      `${field} must contain at most ${maxLength} characters`,
    );
  }
  return normalized || null;
}

function identifier(value, field) {
  return requiredText(value, field, 100);
}

function coordinates(lat, lon, { required = false } = {}) {
  const hasLat = lat !== undefined && lat !== null && lat !== "";
  const hasLon = lon !== undefined && lon !== null && lon !== "";
  if (!hasLat && !hasLon && !required) return undefined;
  if (!hasLat || !hasLon) {
    throw new CatalogInputError("lat and lon must be provided together");
  }

  const hasNumericTypes = [lat, lon].every(
    (value) => typeof value === "number"
      || (typeof value === "string" && value.trim()),
  );
  const normalizedLat = Number(lat);
  const normalizedLon = Number(lon);
  if (
    !hasNumericTypes
    || !Number.isFinite(normalizedLat)
    || !Number.isFinite(normalizedLon)
    || normalizedLat < -90
    || normalizedLat > 90
    || normalizedLon < -180
    || normalizedLon > 180
  ) {
    throw new CatalogInputError("Invalid coordinates");
  }
  return { lat: normalizedLat, lon: normalizedLon };
}

function price(value) {
  const hasNumericType = typeof value === "number"
    || (typeof value === "string" && value.trim());
  const normalized = Number(value);
  if (
    !hasNumericType
    || !Number.isFinite(normalized)
    || normalized <= 0
    || normalized > 100_000_000
  ) {
    throw new CatalogInputError(
      "price must be greater than 0 and at most 100000000",
    );
  }
  return normalized;
}

function email(value) {
  const normalized = optionalText(value, "email", 320);
  if (
    normalized
    && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new CatalogInputError("Invalid email");
  }
  return normalized;
}

function productFields(body, { partial = false } = {}) {
  const input = body || {};
  const fields = {};

  if (!partial || input.name !== undefined) {
    fields.name = requiredText(input.name, "name", 200);
  }
  if (!partial || input.price !== undefined) {
    fields.price = price(input.price);
  }
  if (!partial || input.unit !== undefined) {
    fields.unit = optionalText(input.unit, "unit", 50) || "pièce";
  }
  if (partial && input.isAvailable !== undefined) {
    if (typeof input.isAvailable !== "boolean") {
      throw new CatalogInputError("isAvailable must be a boolean");
    }
    fields.isAvailable = input.isAvailable;
  }
  return fields;
}

export function parseVendorCreationInput(body) {
  const input = body || {};
  const point = coordinates(input.lat, input.lon, { required: true });
  if (input.products !== undefined && !Array.isArray(input.products)) {
    throw new CatalogInputError("products must be an array");
  }
  if ((input.products?.length || 0) > 100) {
    throw new CatalogInputError("products cannot contain more than 100 items");
  }

  return {
    name: requiredText(input.name, "name", 200),
    category: requiredText(input.category, "category", 100),
    description: optionalText(input.description, "description", 2000) ?? null,
    phone: optionalText(input.phone, "phone", 50) ?? "+22800000000",
    ...point,
    products: (input.products || []).map((product) => productFields(product)),
  };
}

export function parseVendorUpdateInput(body) {
  const input = body || {};
  const vendorId = identifier(input.vendorId, "vendorId");
  const fields = {};

  if (input.name !== undefined) {
    fields.name = requiredText(input.name, "name", 200);
  }
  if (input.category !== undefined) {
    fields.category = requiredText(input.category, "category", 100);
  }
  for (const [field, maxLength] of [
    ["description", 2000],
    ["phone", 50],
    ["address", 500],
    ["neighborhood", 200],
  ]) {
    if (input[field] !== undefined) {
      fields[field] = optionalText(input[field], field, maxLength);
    }
  }
  if (input.email !== undefined) fields.email = email(input.email);

  const point = coordinates(input.lat, input.lon);
  if (point) fields.location = point;
  if (Object.keys(fields).length === 0) {
    throw new CatalogInputError("No fields to update");
  }
  return { vendorId, fields };
}

export function parseFacilityCreationInput(body) {
  const input = body || {};
  const type = typeof input.type === "string"
    ? input.type.trim() || "fixed"
    : input.type || "fixed";
  if (!["fixed", "mobile"].includes(type)) {
    throw new CatalogInputError("type must be fixed or mobile");
  }
  return {
    vendorId: identifier(input.vendorId, "vendorId"),
    name: requiredText(input.name, "name", 200),
    category: requiredText(input.category, "category", 100),
    type,
    description: optionalText(input.description, "description", 2000) ?? null,
    address: optionalText(input.address, "address", 500) ?? null,
    neighborhood: optionalText(input.neighborhood, "neighborhood", 200) ?? null,
    ...coordinates(input.lat, input.lon, { required: true }),
  };
}

export function parseFacilityUpdateInput(body) {
  const input = body || {};
  const fields = {};

  if (input.name !== undefined) {
    fields.name = requiredText(input.name, "name", 200);
  }
  if (input.category !== undefined) {
    fields.category = requiredText(input.category, "category", 100);
  }
  if (input.type !== undefined) {
    const type = typeof input.type === "string" ? input.type.trim() : input.type;
    if (!["fixed", "mobile"].includes(type)) {
      throw new CatalogInputError("type must be fixed or mobile");
    }
    fields.type = type;
  }
  for (const [field, maxLength] of [
    ["description", 2000],
    ["address", 500],
    ["neighborhood", 200],
  ]) {
    if (input[field] !== undefined) {
      fields[field] = optionalText(input[field], field, maxLength);
    }
  }
  const point = coordinates(input.lat, input.lon);
  if (point) fields.location = point;
  if (Object.keys(fields).length === 0) {
    throw new CatalogInputError("No fields to update");
  }
  return fields;
}

export function parseProductCreationInput(body) {
  const input = body || {};
  return {
    vendorId: identifier(input.vendorId, "vendorId"),
    facilityId: input.facilityId
      ? identifier(input.facilityId, "facilityId")
      : null,
    ...productFields(input),
  };
}

export function parseProductUpdateInput(body) {
  const input = body || {};
  const vendorId = identifier(input.vendorId, "vendorId");
  const fields = productFields(input, { partial: true });
  if (Object.keys(fields).length === 0) {
    throw new CatalogInputError("No fields to update");
  }
  return { vendorId, fields };
}
