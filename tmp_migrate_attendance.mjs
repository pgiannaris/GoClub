// Deprecated.
// Attendance schema changes now live in apps/web/supabase/migrations.
// Do not store Supabase service-role keys in source files.

console.error(
  [
    'tmp_migrate_attendance.mjs is deprecated.',
    'Use the SQL migrations in apps/web/supabase/migrations instead.',
    'Latest cleanup migration: 20260316090000_schema_cleanup.sql',
  ].join('\n'),
);

process.exitCode = 1;
