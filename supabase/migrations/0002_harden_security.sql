-- v_billing_cycles defaulted to SECURITY DEFINER, which runs as the view's
-- owner and bypasses fuel_cycles' RLS policies entirely — any authenticated
-- user querying it could see every user's fill-ups. Force it to run as the
-- querying user instead, so RLS applies normally.
alter view public.v_billing_cycles set (security_invoker = true);

-- Pin the search_path so the trigger function can't be hijacked by a
-- search_path manipulated by the calling session/role.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
