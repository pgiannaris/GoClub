DO $$
BEGIN
  IF to_regclass('public.attendance_entries') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'attendance_entries_status_check'
        AND conrelid = 'public.attendance_entries'::regclass
    ) THEN
      ALTER TABLE public.attendance_entries
        DROP CONSTRAINT attendance_entries_status_check;
    END IF;

    ALTER TABLE public.attendance_entries
      ADD CONSTRAINT attendance_entries_status_check
      CHECK (status IN ('present', 'excused', 'absent', 'late'));
  END IF;
END;
$$;
