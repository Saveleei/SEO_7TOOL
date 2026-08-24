import {
  getLeadProfile as getProfile,
  leadProfileByKey as profileByKey,
  resolveLeadProfileKey as resolveProfileKey,
} from "./lead-generation.mjs";

export type LeadProfileKey =
  | "MAGNETIC_DRILL_SELECTION"
  | "EQUIPMENT_SELECTION"
  | "CUTTER_SELECTION"
  | "KIT_CALCULATION"
  | "COMPATIBILITY_CHECK"
  | "COMMERCIAL_OFFER";

export type LeadProfile = {
  key: LeadProfileKey;
  ctaKey: string;
  leadType: "equipment_selection" | "content_request";
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  success: string;
  questions: Array<{ name: string; label: string; placeholder: string }>;
};

export type LeadProfileContext = {
  leadFormType?: string | null;
  intentClass?: string | null;
  categorySlug?: string | null;
  toolType?: string | null;
};

export function resolveLeadProfileKey(context: LeadProfileContext): LeadProfileKey {
  return resolveProfileKey(context) as LeadProfileKey;
}

export function getLeadProfile(context: LeadProfileContext): LeadProfile {
  return getProfile(context) as LeadProfile;
}

export function leadProfileByKey(key: LeadProfileKey): LeadProfile {
  return profileByKey(key) as LeadProfile;
}
