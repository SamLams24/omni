import { MapPin, Star, Navigation } from "lucide-react";
import VerificationBadge from "./VerificationBadge";

export default function FacilityCard({ facility, onSelect, onNavigate, onContact, isAuthenticated }) {
  const stars = facility.rating ? Math.round(facility.rating) : 0;
  const distanceText = facility.distance
    ? facility.distance < 1000
      ? `${Math.round(facility.distance)}m`
      : `${(facility.distance / 1000).toFixed(1)}km`
    : "À proximité";

  return (
    <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] hover:border-white/10 transition-all p-4 cursor-pointer" onClick={onSelect}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white text-sm font-medium truncate">{facility.facility_name}</h3>
            {facility.type === 'mobile' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Mobile
              </span>
            )}
            {facility.verification_status && (
              <VerificationBadge status={facility.verification_status} compact />
            )}
          </div>
          <p className="text-white/40 text-xs mt-0.5">{facility.vendor_name}</p>
          <p className="text-white/30 text-xs mt-0.5 truncate">{facility.category}</p>
        </div>
        {facility.rating && (
          <div className="flex items-center gap-1 shrink-0">
            <Star size={12} className="text-amber-400 fill-amber-400" />
            <span className="text-white/60 text-xs">{facility.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex items-center gap-3 text-xs text-white/30 mb-3">
        <span>{distanceText}</span>
        {facility.avg_price > 0 && <span>~{facility.avg_price.toLocaleString()} FCFA</span>}
        <span>{facility.product_count} produit{facility.product_count > 1 ? 's' : ''}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-white/70 text-xs transition-all flex items-center justify-center gap-1"
        >
          <Navigation size={12} />
          Itinéraire
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onContact(); }}
          className="flex-1 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs transition-all flex items-center justify-center gap-1"
        >
          Contacter
        </button>
      </div>

      {/* Product count */}
      {facility.product_count > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center gap-1 text-[10px] text-white/20">
          <MapPin size={10} />
          <span>{facility.product_count} produit{facility.product_count > 1 ? 's' : ''} disponible{facility.product_count > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}
