-- Lint only: two uuid[] variables in private.reorder_course started from the text '{}', which Postgres
-- converts at run time but the database linter flags. The behaviour does not change. The function is
-- replaced whole, because the migration that created it may already be applied.

create or replace function private.reorder_course(_course uuid, _order jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry jsonb;
  lesson jsonb;
  section_index integer := 0;
  lesson_index integer;
  section_ids uuid[] := array[]::uuid[];
  lesson_ids uuid[] := array[]::uuid[];
  this_section uuid;
  this_lesson uuid;
begin
  if not (select private.has_role('admin')) then
    raise exception 'Only an admin can change a course.' using errcode = '42501';
  end if;
  if _order is null or jsonb_typeof(_order) <> 'array' or jsonb_array_length(_order) > 200 then
    raise exception 'That order is not valid.' using errcode = '22023';
  end if;

  for entry in select * from jsonb_array_elements(_order) loop
    this_section := private.try_uuid(entry ->> 'section');
    if this_section is null or jsonb_typeof(entry -> 'lessons') <> 'array' then
      raise exception 'That order is not valid.' using errcode = '22023';
    end if;
    section_ids := section_ids || this_section;
    for lesson in select * from jsonb_array_elements(entry -> 'lessons') loop
      this_lesson := private.try_uuid(lesson #>> '{}');
      if this_lesson is null then
        raise exception 'That order is not valid.' using errcode = '22023';
      end if;
      lesson_ids := lesson_ids || this_lesson;
    end loop;
  end loop;

  -- Every current section and lesson of the course, once each, and nothing else.
  if (select count(distinct x) from unnest(section_ids) x) <> cardinality(section_ids)
    or (select count(distinct x) from unnest(lesson_ids) x) <> cardinality(lesson_ids)
    or (select array_agg(s.id order by s.id) from public.education_sections s where s.course_id = _course and s.archived_at is null)
       is distinct from (select array_agg(x order by x) from unnest(section_ids) x)
    or coalesce((select array_agg(m.id order by m.id) from public.education_modules m
                 join public.education_sections s on s.id = m.section_id
                 where s.course_id = _course and s.archived_at is null and m.archived_at is null), '{}')
       is distinct from coalesce((select array_agg(x order by x) from unnest(lesson_ids) x), '{}')
  then
    raise exception 'The course has changed. Reload the page and try again.' using errcode = '40001';
  end if;

  for entry in select * from jsonb_array_elements(_order) loop
    this_section := (entry ->> 'section')::uuid;
    update public.education_sections set position = section_index where id = this_section and position is distinct from section_index;
    lesson_index := 0;
    for lesson in select * from jsonb_array_elements(entry -> 'lessons') loop
      update public.education_modules
      set position = lesson_index, section_id = this_section
      where id = (lesson #>> '{}')::uuid and (position is distinct from lesson_index or section_id is distinct from this_section);
      lesson_index := lesson_index + 1;
    end loop;
    section_index := section_index + 1;
  end loop;
end;
$$;
