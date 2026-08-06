export function buildCartResponse(requests, { confirmAll, items }) {
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new Error("Cart has no availability requests");
  }
  if (requests.some((item) => item.status !== "pending")) {
    throw new Error("All cart items must be pending before responding");
  }

  const byId = new Map(requests.map((item) => [item.id, item]));
  let responses;

  if (confirmAll === true) {
    responses = requests.map((item) => ({
      request_id: item.id,
      status: "confirmed",
      quantity_confirmed: Number(item.quantity_requested),
    }));
  } else {
    if (!Array.isArray(items) || items.length !== requests.length) {
      throw new Error("A response is required for every cart item");
    }

    const seen = new Set();
    responses = items.map((item) => {
      const request = byId.get(item.requestId);
      if (!request || seen.has(item.requestId)) {
        throw new Error("Cart response contains an invalid or duplicate item");
      }
      seen.add(item.requestId);

      if (!["confirmed", "denied"].includes(item.status)) {
        throw new Error("Item status must be confirmed or denied");
      }

      if (item.status === "denied") {
        return {
          request_id: item.requestId,
          status: "denied",
          quantity_confirmed: null,
        };
      }

      const quantity = Number(item.quantityConfirmed);
      const requested = Number(request.quantity_requested);
      if (
        !Number.isInteger(quantity)
        || quantity < 1
        || quantity > requested
      ) {
        throw new Error(
          "Confirmed quantity must be between 1 and the requested quantity",
        );
      }

      return {
        request_id: item.requestId,
        status: "confirmed",
        quantity_confirmed: quantity,
      };
    });
  }

  const confirmed = responses.filter((item) => item.status === "confirmed");
  const cartStatus = confirmed.length === 0
    ? "denied"
    : confirmed.length === responses.length
      ? "confirmed"
      : "partial";
  const total = confirmed.reduce((sum, item) => {
    const request = byId.get(item.request_id);
    return sum + Number(request.price) * item.quantity_confirmed;
  }, 0);

  if (!Number.isFinite(total) || total < 0) {
    throw new Error("Cart total is invalid");
  }

  return {
    responses,
    cartStatus,
    total,
  };
}
