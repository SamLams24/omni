import { ShieldCheck, BadgeCheck, CircleHelp } from "lucide-react";
import { VERIFICATION_STATUS_LABELS } from "@/lib/vendor-verification";

const STYLES = {
  non_verifiee: { icon: CircleHelp, className: "bg-zinc-800 text-zinc-400" },
  verifiee: { icon: ShieldCheck, className: "bg-blue-500/10 text-blue-400" },
  certifiee: { icon: BadgeCheck, className: "bg-emerald-500/10 text-emerald-400" },
};

export default function VerificationBadge({ status, compact }) {
  const config = STYLES[status];
  if (!config) return null;
  const Icon = config.icon;
  const label = VERIFICATION_STATUS_LABELS[status];

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.className}`}>
        <Icon size={10} aria-hidden="true" />
        {label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${config.className}`}>
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}
