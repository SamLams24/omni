"use client";

import { useState } from "react";
import { useNavigate } from "react-router";
import {
  signInWithCredentials,
  signUpWithCredentials,
} from "@/lib/auth-client";

export function NeonAuthWrapper({ redirectUrl = "/map" }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");

  const checkVendorAndRedirect = async (user) => {
    localStorage.setItem("omni_user", JSON.stringify(user));

    if (!localStorage.getItem("onboarding_done")) {
      navigate("/onboarding");
      return;
    }

    try {
      const response = await fetch("/api/vendors/my-vendor");
      const data = await response.json();

      if (data.vendor) {
        navigate("/vendor/dashboard");
      } else {
        navigate(redirectUrl);
      }
    } catch (err) {
      navigate(redirectUrl);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(e.target);
    const email = formData.get("email");
    const password = formData.get("password");

    try {
      const result = isSignUp
        ? await signUpWithCredentials({
            email, 
            password, 
            name: name || email.split('@')[0] 
          })
        : await signInWithCredentials({ email, password });

      if (result.error) {
        setError(result.error.message || "Authentication failed");
        setIsLoading(false);
        return;
      }

      if (result.data?.user) {
        checkVendorAndRedirect(result.data.user);
      } else {
        navigate(redirectUrl);
      }
    } catch {
      setError("Network error. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          {isSignUp ? "Créer un compte" : "Se connecter"}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm text-white/60 mb-2">Nom</label>
              <input
                type="text"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
                placeholder="Votre nom"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-white/60 mb-2">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">Mot de passe</label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>{isSignUp ? "S'inscrire" : "Se connecter"}</>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            {isSignUp ? "Déjà un compte ? Se connecter" : "Pas de compte ? S'inscrire"}
          </button>
        </div>
      </div>
    </div>
  );
}
