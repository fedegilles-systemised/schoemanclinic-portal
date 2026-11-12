/**
 * The treatment-option confirmations on a clinical note, for the CQC audit trail (Dr Schoeman, 12
 * November 2026). Ticked by the author on the draft; fixed with the rest of the note once signed.
 */
export type TreatmentOptions = {
  allOptionsDiscussed: boolean;
  customisedOptionsDiscussed: boolean;
  niceOptionsDiscussed: boolean;
  sideEffectsDiscussed: boolean;
  optionsOffered: string | null;
};

export const NO_OPTIONS: TreatmentOptions = {
  allOptionsDiscussed: false,
  customisedOptionsDiscussed: false,
  niceOptionsDiscussed: false,
  sideEffectsDiscussed: false,
  optionsOffered: null,
};

export const OPTION_CHECKS = [
  ["allOptionsDiscussed", "all_options_discussed", "All available treatment options discussed"],
  ["customisedOptionsDiscussed", "customised_options_discussed", "Customised options discussed"],
  ["niceOptionsDiscussed", "nice_options_discussed", "NICE guideline options discussed"],
  ["sideEffectsDiscussed", "side_effects_discussed", "Side effects discussed"],
] as const;

export function hasAnyOption(o: TreatmentOptions): boolean {
  return o.allOptionsDiscussed || o.customisedOptionsDiscussed || o.niceOptionsDiscussed || o.sideEffectsDiscussed || Boolean(o.optionsOffered);
}
