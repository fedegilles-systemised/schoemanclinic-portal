-- A base set of 21 common biomarkers with standard reference ranges, for a project whose marker
-- list is still empty. Run by hand in the Supabase SQL editor, before demo-more.sql.
-- A marker is catalogue: it cannot be deleted or archived afterwards. The ranges are the standard
-- adult ones and are a starting point, not the clinic's own. Replace them with the clinic's list
-- when it is loaded (`update public.markers set ref_low = ..., ref_high = ... where code = ...`).
-- Safe to run twice: a code that exists is left exactly as it is.

insert into public.markers (code, name, category, unit, ref_low, ref_high, explainer) values
  ('HBA1C', 'HbA1c', 'Metabolic', 'mmol/mol', 20, 41, 'Your average blood sugar over the last two to three months.'),
  ('GLUCOSE', 'Fasting glucose', 'Metabolic', 'mmol/L', 3.9, 5.5, 'The sugar in your blood after an overnight fast.'),
  ('CRP', 'hs-CRP', 'Metabolic', 'mg/L', null, 3.0, 'A sensitive marker of inflammation in the body.'),
  ('ALT', 'ALT', 'Metabolic', 'U/L', 0, 41, 'A liver enzyme.'),
  ('EGFR', 'eGFR', 'Metabolic', 'mL/min', 60, null, 'How well your kidneys filter your blood.'),
  ('VITD', 'Vitamin D', 'Vitamins and minerals', 'nmol/L', 75, 200, 'Supports bones, muscles and immunity. Levels drop in autumn and winter.'),
  ('FERRITIN', 'Ferritin', 'Vitamins and minerals', 'µg/L', 30, 200, 'Shows how much iron your body has in store.'),
  ('B12', 'Vitamin B12', 'Vitamins and minerals', 'ng/L', 180, 900, 'Needed for nerves and red blood cells.'),
  ('HB', 'Haemoglobin', 'Haematology', 'g/L', 115, 165, 'The protein in red blood cells that carries oxygen.'),
  ('HCT', 'Haematocrit', 'Haematology', 'L/L', 0.40, 0.52, 'The share of your blood made up of red blood cells.'),
  ('TCHOL', 'Total cholesterol', 'Lipids', 'mmol/L', null, 5.0, 'All the cholesterol in your blood, good and less good.'),
  ('HDL', 'HDL cholesterol', 'Lipids', 'mmol/L', 1.2, null, 'The protective type of cholesterol. Higher is better.'),
  ('LDL', 'LDL cholesterol', 'Lipids', 'mmol/L', null, 3.0, 'The type of cholesterol that can build up in arteries.'),
  ('TRIG', 'Triglycerides', 'Lipids', 'mmol/L', null, 1.7, 'A type of fat in your blood.'),
  ('TSH', 'TSH', 'Thyroid', 'mIU/L', 0.4, 4.0, 'The signal your brain sends to the thyroid gland.'),
  ('FT4', 'Free T4', 'Thyroid', 'pmol/L', 12, 22, 'The main hormone your thyroid makes.'),
  ('FT3', 'Free T3', 'Thyroid', 'pmol/L', 3.1, 6.8, 'The active form of thyroid hormone.'),
  ('TPOAB', 'TPO antibodies', 'Thyroid', 'IU/mL', null, 34, 'Antibodies that can affect the thyroid gland.'),
  ('OEST', 'Oestradiol', 'Hormones', 'pmol/L', null, null, 'The main form of oestrogen. Its range depends on your cycle and menopause stage.'),
  ('FSH', 'FSH', 'Hormones', 'IU/L', null, null, 'A hormone that rises as you move towards menopause.'),
  ('TESTO', 'Total testosterone', 'Hormones', 'nmol/L', 8.6, 29.0, 'The main male hormone, also present in women.')
on conflict (code) do nothing;
