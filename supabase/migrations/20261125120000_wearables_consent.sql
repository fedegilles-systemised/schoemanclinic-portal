-- A patient (or a guardian who can act) agrees before a wearable account is linked to their record.
-- An enum value cannot be used in the transaction that adds it, so this stands alone.
alter type public.consent_type add value if not exists 'wearables';
