-- Run in Supabase SQL Editor after the base schema (adds location + birthdate fields)

alter table public.profiles
    add column if not exists division text default 'Dhaka',
    add column if not exists district text default 'Dhaka',
    add column if not exists address_line text default '',
    add column if not exists landmark text default '',
    add column if not exists birthdate date;

alter table public.orders
    add column if not exists division text default '',
    add column if not exists district text default '',
    add column if not exists address_line text default '',
    add column if not exists landmark text default '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (
        id, email, name, phone, division, district, area, address_line, landmark, address, birthdate
    )
    values (
        new.id,
        coalesce(new.email, ''),
        coalesce(new.raw_user_meta_data->>'name', ''),
        coalesce(new.raw_user_meta_data->>'phone', ''),
        coalesce(new.raw_user_meta_data->>'division', 'Dhaka'),
        coalesce(new.raw_user_meta_data->>'district', 'Dhaka'),
        coalesce(new.raw_user_meta_data->>'area', 'Gulshan'),
        coalesce(new.raw_user_meta_data->>'address_line', coalesce(new.raw_user_meta_data->>'address', '')),
        coalesce(new.raw_user_meta_data->>'landmark', ''),
        coalesce(new.raw_user_meta_data->>'address', ''),
        nullif(new.raw_user_meta_data->>'birthdate', '')::date
    )
    on conflict (id) do nothing;
    return new;
end;
$$;
