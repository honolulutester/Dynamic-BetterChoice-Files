-- BetterChoice Supabase schema
-- Run in Supabase Dashboard → SQL Editor → New query → Run

-- Profiles (extends auth.users)
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null,
    name text not null default '',
    phone text default '',
    area text default 'Gulshan',
    address text default '',
    wallet numeric not null default 0,
    lifetime_credits numeric not null default 0,
    cart jsonb not null default '[]'::jsonb,
    bookings jsonb not null default '[]'::jsonb,
    saved_workouts jsonb,
    saved_meals jsonb,
    subscribed boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Orders
create table if not exists public.orders (
    id text primary key,
    user_id uuid references auth.users (id) on delete set null,
    tracking_code text not null,
    order_date text not null,
    slot text not null,
    items_count int not null default 0,
    line_items jsonb not null default '[]'::jsonb,
    price numeric not null,
    status text not null default 'Confirmed',
    payment_method text not null default 'bKash',
    delivery_fee numeric not null default 0,
    coupon_discount numeric not null default 0,
    wallet_applied numeric not null default 0,
    recipient_name text not null,
    phone text not null,
    area text not null,
    address text not null,
    is_guest boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- Wishlist
create table if not exists public.wishlist (
    user_id uuid not null references auth.users (id) on delete cascade,
    product_id text not null,
    created_at timestamptz not null default now(),
    primary key (user_id, product_id)
);

-- Packaging return requests
create table if not exists public.return_requests (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    qty int not null,
    container_type text not null,
    notes text default '',
    status text not null default 'Pending Pickup',
    created_at timestamptz not null default now()
);

-- Product reviews
create table if not exists public.product_reviews (
    id uuid primary key default gen_random_uuid(),
    product_id text not null,
    user_id uuid references auth.users (id) on delete set null,
    user_name text not null,
    rating int not null check (rating between 1 and 5),
    review_text text not null,
    created_at timestamptz not null default now()
);

create index if not exists product_reviews_product_id_idx on public.product_reviews (product_id);

-- Newsletter
create table if not exists public.newsletter_subscribers (
    email text primary key,
    subscribed_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.wishlist enable row level security;
alter table public.return_requests enable row level security;
alter table public.product_reviews enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- Profiles: own row only
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Orders: own orders + guest inserts
create policy "orders_select_own" on public.orders for select using (auth.uid() = user_id);
create policy "orders_insert" on public.orders for insert with check (
    user_id is null or auth.uid() = user_id
);

-- Wishlist
create policy "wishlist_all_own" on public.wishlist for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Return requests
create policy "returns_all_own" on public.return_requests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reviews: anyone read, auth users insert own
create policy "reviews_select_all" on public.product_reviews for select using (true);
create policy "reviews_insert_auth" on public.product_reviews for insert with check (auth.uid() = user_id);

-- Newsletter: anyone can subscribe
create policy "newsletter_insert" on public.newsletter_subscribers for insert with check (true);

-- Track order by ID (public RPC)
create or replace function public.get_order_for_tracking(order_id text)
returns setof public.orders
language sql
security definer
set search_path = public
as $$
    select * from public.orders where upper(id) = upper(order_id) limit 1;
$$;

grant execute on function public.get_order_for_tracking(text) to anon, authenticated;

-- Merchant: issue eco-credits (PIN-protected demo RPC)
create or replace function public.merchant_issue_credits(
    target_email text,
    credit_amount numeric,
    pin text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    affected int;
begin
    if pin <> '8822' then
        raise exception 'Invalid merchant PIN';
    end if;
    update public.profiles
    set wallet = wallet + credit_amount,
        lifetime_credits = lifetime_credits + credit_amount,
        updated_at = now()
    where lower(email) = lower(trim(target_email));
    get diagnostics affected = row_count;
    return affected > 0;
end;
$$;

grant execute on function public.merchant_issue_credits(text, numeric, text) to anon, authenticated;

-- Merchant: advance order status
create or replace function public.merchant_advance_order(order_id text, pin text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    current_status text;
    statuses text[] := array['Confirmed', 'Packed', 'Out for Delivery', 'Delivered'];
    idx int;
begin
    if pin <> '8822' then
        raise exception 'Invalid merchant PIN';
    end if;
    select status into current_status from public.orders where upper(id) = upper(order_id);
    if not found then
        return null;
    end if;
    idx := array_position(statuses, current_status);
    if idx is null then idx := 1; end if;
    if idx < array_length(statuses, 1) then
        update public.orders set status = statuses[idx + 1] where upper(id) = upper(order_id);
        return statuses[idx + 1];
    end if;
    return current_status;
end;
$$;

grant execute on function public.merchant_advance_order(text, text) to anon, authenticated;

-- Merchant: update order status in DB also updates wallet on profile when needed via separate RPC

-- Auto-create profile when a user signs up (works with email confirmation flow)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, name, phone, area, address)
    values (
        new.id,
        coalesce(new.email, ''),
        coalesce(new.raw_user_meta_data->>'name', ''),
        coalesce(new.raw_user_meta_data->>'phone', ''),
        coalesce(new.raw_user_meta_data->>'area', 'Gulshan'),
        coalesce(new.raw_user_meta_data->>'address', '')
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
