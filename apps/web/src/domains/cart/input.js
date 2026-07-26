export class CartInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "CartInputError";
    this.status = status;
  }
}

export function parseCartCreationInput(body) {
  const {
    facilityId,
    items,
    note,
    paymentMethod,
    delivery,
    dropoffAddress,
    dropoffLat,
    dropoffLon,
  } = body || {};
  const selectedPaymentMethod = paymentMethod || "cash";
  const wantsDelivery = delivery === true;

  if (
    !facilityId
    || !Array.isArray(items)
    || items.length === 0
    || items.length > 50
  ) {
    throw new CartInputError("facilityId and items are required");
  }
  if (!["cash", "escrow"].includes(selectedPaymentMethod)) {
    throw new CartInputError("Invalid payment method");
  }

  const productIds = new Set();
  const normalizedItems = items.map((item) => {
    const quantity = Number(item?.quantity);
    if (
      !item?.productId
      || productIds.has(item.productId)
      || !Number.isInteger(quantity)
      || quantity < 1
      || quantity > 999
    ) {
      throw new CartInputError(
        "Cart items must have unique products and valid quantities",
      );
    }
    productIds.add(item.productId);
    return {
      product_id: item.productId,
      quantity_requested: quantity,
    };
  });

  let normalizedDropoffLat = 0;
  let normalizedDropoffLon = 0;
  if (wantsDelivery) {
    normalizedDropoffLat = Number(dropoffLat);
    normalizedDropoffLon = Number(dropoffLon);
    if (
      dropoffLat == null
      || dropoffLon == null
      || dropoffLat === ""
      || dropoffLon === ""
      || !Number.isFinite(normalizedDropoffLat)
      || !Number.isFinite(normalizedDropoffLon)
      || normalizedDropoffLat < -90
      || normalizedDropoffLat > 90
      || normalizedDropoffLon < -180
      || normalizedDropoffLon > 180
    ) {
      throw new CartInputError(
        "dropoffLat and dropoffLon are required for delivery",
      );
    }
  }

  return {
    facilityId,
    items: normalizedItems,
    note: note || null,
    paymentMethod: selectedPaymentMethod,
    wantsDelivery,
    dropoffAddress: dropoffAddress || null,
    dropoffLat: normalizedDropoffLat,
    dropoffLon: normalizedDropoffLon,
  };
}

export function parseAvailabilityRequestInput(body) {
  const { vendorId, facilityId, productId, quantity } = body || {};
  const requestedQuantity = Number(quantity);
  if (
    !vendorId
    || !productId
    || !Number.isInteger(requestedQuantity)
    || requestedQuantity < 1
    || requestedQuantity > 999
  ) {
    throw new CartInputError(
      "A vendor, product and valid quantity are required",
    );
  }

  return {
    vendorId,
    facilityId,
    productId,
    quantity: requestedQuantity,
  };
}

export function parseAvailabilityResponseInput(body) {
  const { requestId, status, quantityConfirmed } = body || {};
  if (!requestId || !["confirmed", "denied"].includes(status)) {
    throw new CartInputError("A valid requestId and status are required");
  }
  return { requestId, status, quantityConfirmed };
}

export function normalizeConfirmedQuantity(
  status,
  quantityConfirmed,
  requestedQuantity,
) {
  if (status === "denied") return null;

  const quantity = Number(quantityConfirmed);
  if (
    !Number.isInteger(quantity)
    || quantity < 1
    || quantity > Number(requestedQuantity)
  ) {
    throw new CartInputError("Confirmed quantity is invalid");
  }
  return quantity;
}

export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const radiusKm = 6371;
  const toRadians = (value) => value * Math.PI / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat1))
    * Math.cos(toRadians(lat2))
    * Math.sin(deltaLon / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateDeliveryFee(
  pickupLat,
  pickupLon,
  dropoffLat,
  dropoffLon,
) {
  if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLon)) {
    throw new CartInputError("Facility location is unavailable", 409);
  }
  return Math.max(
    500,
    Math.round(
      calculateDistanceKm(pickupLat, pickupLon, dropoffLat, dropoffLon) * 100,
    ),
  );
}
