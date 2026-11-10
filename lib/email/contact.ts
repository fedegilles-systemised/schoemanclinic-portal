/**
 * The clinic's three ways to be reached. Every email closes with the same three, in this order:
 * phone, email, WhatsApp. Change them here and run `pnpm email:build`; the sign-in service emails
 * in Supabase must then be pasted again.
 */
export const clinicContact = {
  phone: { label: "+44 (0)20 3006 3224", href: "tel:+442030063224" },
  email: { label: "info@theschoemanclinic.com", href: "mailto:info@theschoemanclinic.com" },
  whatsapp: { label: "+44 7426 494 321", href: "https://wa.me/447426494321" },
} as const;

/** The closing line as plain text, for the text version of an email. */
export const contactLineText = `We are here if you need us. Phone ${clinicContact.phone.label}, email ${clinicContact.email.label} or WhatsApp ${clinicContact.whatsapp.label}.`;
