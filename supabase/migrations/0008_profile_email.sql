-- Keep each profile's login email available to admin client-management views.
alter table public.profiles add column email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id;