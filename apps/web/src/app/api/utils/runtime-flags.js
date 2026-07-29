const ENABLED_VALUE = "true";

export function isNonProductionFeatureEnabled(flagName, env = process.env) {
  return env.NODE_ENV !== "production" && env[flagName] === ENABLED_VALUE;
}

export function requireNonProductionFeature(flagName, env = process.env) {
  if (isNonProductionFeatureEnabled(flagName, env)) {
    return null;
  }

  return Response.json(
    {
      error: "Cette fonctionnalité est temporairement indisponible.",
      code: "FEATURE_DISABLED",
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
