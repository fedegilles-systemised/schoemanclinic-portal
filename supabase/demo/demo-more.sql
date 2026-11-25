-- More made-up patients, with several blood reports each over about a year, and the results for
-- the demo accounts already created by demo-load.sql. Run by hand in the Supabase SQL editor
-- after demo-load.sql and demo-markers.sql. Fictional data only.
--
--   Claire Demo   perimenopause: FSH up, oestradiol down, TSH drifting past its range, vitamin D recovering
--   Oliver Demo   testosterone rising from low, HbA1c and LDL falling, HDL rising
--   Sophie Demo   iron, haemoglobin, B12 and vitamin D recovering
--   Daniel Demo   type 2 diabetes improving: HbA1c, glucose, triglycerides, ALT and CRP falling; latest report waiting for the doctor
--   Hannah Demo   thyroid settling: TSH falling into range, FT4 and FT3 rising; latest report waiting for the doctor
--
-- They have no sign-in. Open them as demo.doctor@example.test, whose care team they join.
-- It also adds the results that demo-load.sql could not add while the marker list was empty.
-- Wind it down with demo-unload.sql, which already covers the DEMO- patients.

do $more$
declare
  v_doc uuid := 'be000000-0000-4000-8000-000000000001';
  v_loc uuid; v_partner uuid;
  c record; rep record; v_pid uuid; v_rid uuid;
begin
  if not exists (select 1 from auth.users where id = 'ae000000-0000-4000-8000-000000000001') then
    raise exception 'Run demo-load.sql first.';
  end if;
  if exists (select 1 from public.patient_profiles where clinic_ref not like 'DEMO-%') then
    raise exception 'Real patients exist. Do not run the demo in this project.';
  end if;
  if exists (select 1 from public.patient_profiles where clinic_ref = 'DEMO-005') then
    raise exception 'The extra demo patients already exist.';
  end if;
  if (select count(*) from public.markers where code in ('HBA1C','VITD','FERRITIN','TSH','FT4','CRP','TCHOL','HDL','LDL','TRIG','GLUCOSE','ALT','HB','B12','FT3','TPOAB','OEST','FSH','TESTO')) < 19 then
    raise exception 'Run demo-markers.sql first.';
  end if;
  select id into v_loc from public.locations order by created_at limit 1;
  select id into v_partner from public.lab_partners order by created_at limit 1;

  -- The values: (patient ref, days before today, marker code, value) ---------------------------
  create temp table _vals (ref text, ago int, code text, val numeric) on commit drop;
  insert into _vals
  select 'DEMO-005', d.ago, d.code, d.val from (values
    (330,'FSH',9),(240,'FSH',14),(150,'FSH',22),(60,'FSH',31),(10,'FSH',38),
    (330,'OEST',480),(240,'OEST',390),(150,'OEST',260),(60,'OEST',190),(10,'OEST',140),
    (330,'TSH',2.1),(240,'TSH',2.4),(150,'TSH',2.2),(60,'TSH',3.9),(10,'TSH',4.6),
    (330,'VITD',48),(240,'VITD',62),(150,'VITD',81),(60,'VITD',95),(10,'VITD',104)) as d(ago, code, val)
  union all select 'DEMO-006', d.ago, d.code, d.val from (values
    (330,'TESTO',9.2),(240,'TESTO',8.1),(150,'TESTO',12.4),(60,'TESTO',15.6),(10,'TESTO',17.9),
    (330,'HBA1C',44),(240,'HBA1C',43),(150,'HBA1C',40),(60,'HBA1C',38),(10,'HBA1C',37),
    (330,'LDL',3.8),(240,'LDL',3.5),(150,'LDL',3.1),(60,'LDL',2.9),(10,'LDL',2.7),
    (330,'HDL',1.0),(240,'HDL',1.1),(150,'HDL',1.2),(60,'HDL',1.3),(10,'HDL',1.4)) as d(ago, code, val)
  union all select 'DEMO-007', d.ago, d.code, d.val from (values
    (330,'FERRITIN',14),(240,'FERRITIN',18),(150,'FERRITIN',27),(60,'FERRITIN',41),(10,'FERRITIN',63),
    (330,'HB',108),(240,'HB',111),(150,'HB',118),(60,'HB',126),(10,'HB',131),
    (330,'B12',160),(240,'B12',210),(150,'B12',310),(60,'B12',420),(10,'B12',510),
    (330,'VITD',30),(240,'VITD',45),(150,'VITD',70),(60,'VITD',92),(10,'VITD',118)) as d(ago, code, val)
  union all select 'DEMO-008', d.ago, d.code, d.val from (values
    (330,'HBA1C',58),(240,'HBA1C',54),(150,'HBA1C',49),(60,'HBA1C',45),(10,'HBA1C',42),
    (330,'GLUCOSE',8.2),(240,'GLUCOSE',7.4),(150,'GLUCOSE',6.6),(60,'GLUCOSE',6.1),(10,'GLUCOSE',5.8),
    (330,'TRIG',3.1),(240,'TRIG',2.6),(150,'TRIG',2.2),(60,'TRIG',1.8),(10,'TRIG',1.5),
    (330,'ALT',62),(240,'ALT',55),(150,'ALT',47),(60,'ALT',40),(10,'ALT',36),
    (330,'CRP',5.1),(240,'CRP',4.2),(150,'CRP',3.3),(60,'CRP',2.4),(10,'CRP',1.9)) as d(ago, code, val)
  union all select 'DEMO-009', d.ago, d.code, d.val from (values
    (330,'TSH',6.8),(240,'TSH',5.2),(150,'TSH',3.4),(60,'TSH',2.1),(10,'TSH',1.8),
    (330,'FT4',10.1),(240,'FT4',11.2),(150,'FT4',13.5),(60,'FT4',15.4),(10,'FT4',16.8),
    (330,'FT3',2.6),(240,'FT3',3.0),(150,'FT3',3.7),(60,'FT3',4.4),(10,'FT3',4.9),
    (330,'TPOAB',88),(240,'TPOAB',75),(150,'TPOAB',62),(60,'TPOAB',51),(10,'TPOAB',44)) as d(ago, code, val);

  -- Patients ----------------------------------------------------------------------------------
  insert into public.patient_profiles (clinic_ref, first_name, last_name, date_of_birth, sex, contact_email, country, primary_clinician_id, address_line1, city, postcode) values
    ('DEMO-005', 'Claire', 'Demo', '1982-01-07', 'F', 'demo.claire@example.test', 'United Kingdom', v_doc, '1 Example Mews', 'London', 'W1G 0AA'),
    ('DEMO-006', 'Oliver', 'Demo', '1968-05-19', 'M', 'demo.oliver@example.test', 'United Kingdom', v_doc, '1 Example Mews', 'London', 'W1G 0AA'),
    ('DEMO-007', 'Sophie', 'Demo', '1976-11-11', 'F', 'demo.sophie@example.test', 'United Kingdom', v_doc, '1 Example Mews', 'London', 'W1G 0AA'),
    ('DEMO-008', 'Daniel', 'Demo', '1965-04-23', 'M', 'demo.daniel@example.test', 'United Kingdom', v_doc, '1 Example Mews', 'London', 'W1G 0AA'),
    ('DEMO-009', 'Hannah', 'Demo', '1991-08-08', 'F', 'demo.hannah@example.test', 'United Kingdom', v_doc, '1 Example Mews', 'London', 'W1G 0AA');
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'patient_profiles' and column_name = 'registration_required') then
    execute 'update public.patient_profiles set registration_required = false where clinic_ref like ''DEMO-%''';
  end if;
  insert into public.care_team (patient_id, staff_id, relationship, since)
    select id, v_doc, 'primary_doctor', current_date - 340 from public.patient_profiles where clinic_ref between 'DEMO-005' and 'DEMO-009';

  -- Reports and results: five dates each; the latest of Daniel and Hannah waits for the doctor ---
  for rep in
    select distinct v.ref, v.ago from _vals v order by v.ref, v.ago desc
  loop
    select id into v_pid from public.patient_profiles where clinic_ref = rep.ref;
    if rep.ago = 10 and rep.ref in ('DEMO-008', 'DEMO-009') then
      insert into public.lab_reports (patient_id, lab_partner_id, sample_date, received_at, status)
        values (v_pid, v_partner, current_date - rep.ago, now() - interval '2 days', 'awaiting_review') returning id into v_rid;
    else
      insert into public.lab_reports (patient_id, lab_partner_id, sample_date, received_at, status, reviewed_by, reviewed_at, released_at)
        values (v_pid, v_partner, current_date - rep.ago, now() - make_interval(days => rep.ago - 2), 'released', v_doc, now() - make_interval(days => rep.ago - 4), now() - make_interval(days => rep.ago - 4)) returning id into v_rid;
    end if;
    insert into public.results (lab_report_id, patient_id, marker_id, value_numeric, unit, ref_low, ref_high, flag)
      select v_rid, v_pid, m.id, v.val, m.unit, m.ref_low, m.ref_high,
        (case when m.ref_low is not null and v.val < m.ref_low then 'low'
              when m.ref_high is not null and v.val > m.ref_high then 'high' else 'normal' end)::public.result_flag
      from _vals v join public.markers m on m.code = v.code where v.ref = rep.ref and v.ago = rep.ago;
  end loop;

  -- The results demo-load.sql left out for the first patients ----------------------------------
  insert into public.results (lab_report_id, patient_id, marker_id, value_numeric, unit, ref_low, ref_high, flag)
    select v.r, rp.patient_id, m.id, v.val, m.unit, m.ref_low, m.ref_high,
      (case when m.ref_low is not null and v.val < m.ref_low then 'low'
            when m.ref_high is not null and v.val > m.ref_high then 'high' else 'normal' end)::public.result_flag
    from (values
      ('fe000000-0000-4000-8000-000000000001'::uuid,'HBA1C',46::numeric),('fe000000-0000-4000-8000-000000000001','VITD',38),('fe000000-0000-4000-8000-000000000001','FERRITIN',24),
      ('fe000000-0000-4000-8000-000000000001','TSH',2.3),('fe000000-0000-4000-8000-000000000001','FT4',15.1),('fe000000-0000-4000-8000-000000000001','CRP',1.8),
      ('fe000000-0000-4000-8000-000000000002','HBA1C',44),('fe000000-0000-4000-8000-000000000002','VITD',56),('fe000000-0000-4000-8000-000000000002','FERRITIN',31),
      ('fe000000-0000-4000-8000-000000000002','TSH',2.1),('fe000000-0000-4000-8000-000000000002','FT4',15.6),('fe000000-0000-4000-8000-000000000002','CRP',1.4),
      ('fe000000-0000-4000-8000-000000000003','HBA1C',41),('fe000000-0000-4000-8000-000000000003','VITD',88),('fe000000-0000-4000-8000-000000000003','FERRITIN',52),
      ('fe000000-0000-4000-8000-000000000003','TSH',1.9),('fe000000-0000-4000-8000-000000000003','FT4',15.9),('fe000000-0000-4000-8000-000000000003','CRP',1.1),
      ('fe000000-0000-4000-8000-000000000004','TSH',2.8),('fe000000-0000-4000-8000-000000000004','FT4',14.2),('fe000000-0000-4000-8000-000000000004','HBA1C',38)
    ) as v(r, code, val)
    join public.lab_reports rp on rp.id = v.r
    join public.markers m on m.code = v.code
    where not exists (select 1 from public.results x where x.lab_report_id = v.r);

  -- Today's diary ------------------------------------------------------------------------------
  insert into public.appointments (patient_id, clinician_id, location_id, starts_at, duration_min, type, status, source, external_id, synced_at)
    select p.id, v_doc, v_loc, ((current_date) + t.at)::timestamp at time zone 'Europe/London', 30, t.kind, 'confirmed', 'ghl', t.ext, now()
    from (values ('DEMO-008', time '10:30', 'Results review', 'demo_appt_5'), ('DEMO-009', time '11:15', 'Results review', 'demo_appt_6'), ('DEMO-005', time '14:00', 'Follow-up', 'demo_appt_7')) as t(ref, at, kind, ext)
    join public.patient_profiles p on p.clinic_ref = t.ref;

  raise notice 'Extra demo patients and results loaded.';
end
$more$;
