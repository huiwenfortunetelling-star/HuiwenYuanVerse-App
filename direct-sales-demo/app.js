-- Huiwen YuanVerse - Manual PayPal Withdrawal Request System
-- TEST MODE:
--   Minimum withdrawal is ￥0.05 so the workflow can be tested now.
-- PRODUCTION:
--   Boss's intended minimum is ￥200. Change the two "0.05" checks in the
--   create_withdrawal_request function and the frontend constant to 200
--   when the system is ready to go live.
--
-- Rules implemented:
--   * User enters any amount from the minimum up to available balance.
--   * One active request at a time.
--   * 3-day cooldown after the most recent non-rejected request.
--   * User supplies first name, last name, phone, billing address, PayPal email.
--   * No card data is collected.
--   * Admin manually pays through PayPal, then marks the request Paid.
--   * Rejecting a Pending/Approved request restores the reserved amount exactly once.
--   * Rejected requests do not trigger the 3-day cooldown, so corrected info can be resubmitted.

-- ============================================================
-- 1) Extend the existing withdrawals table
-- ============================================================

alter table public.withdrawals
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone_number text,
  add column if not exists billing_address text,
  add column if not exists paypal_email text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.withdrawals enable row level security;

-- Withdrawal PII is accessed only through security-definer RPCs.
revoke all on table public.withdrawals from anon, authenticated;

-- ============================================================
-- 2) Customer: create a partial withdrawal request
-- ============================================================

drop function if exists public.create_withdrawal_request();

create function public.create_withdrawal_request(
  p_amount numeric,
  p_first_name text,
  p_last_name text,
  p_phone_number text,
  p_billing_address text,
  p_paypal_email text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance numeric(12,2);
  v_amount numeric(12,2);
  v_request_id uuid;
  v_last_request_at timestamptz;
  v_phone text := regexp_replace(trim(coalesce(p_phone_number, '')), '[^0-9+]', '', 'g');
  v_paypal_email text := lower(trim(coalesce(p_paypal_email, '')));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (
    select 1
    from public.withdrawals
    where user_id = v_user_id
      and status in ('pending', 'approved')
  ) then
    raise exception 'Active withdrawal already exists';
  end if;

  select max(created_at)
  into v_last_request_at
  from public.withdrawals
  where user_id = v_user_id
    and status <> 'rejected';

  if v_last_request_at is not null
     and v_last_request_at > now() - interval '3 days' then
    raise exception 'Withdrawal cooldown active';
  end if;

  if trim(coalesce(p_first_name, '')) = '' then
    raise exception 'First name required';
  end if;

  if trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Last name required';
  end if;

  if v_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Invalid phone number';
  end if;

  if trim(coalesce(p_billing_address, '')) = '' then
    raise exception 'Billing address required';
  end if;

  if v_paypal_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid PayPal email';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);

  -- TEST minimum. Change 0.05 to 200 for production.
  if v_amount < 0.05 then
    raise exception 'Minimum withdrawal not reached';
  end if;

  select commission_balance
  into v_balance
  from public.profiles
  where id = v_user_id
  for update;

  if v_balance is null or v_balance <= 0 then
    raise exception 'No available balance';
  end if;

  if v_amount > v_balance then
    raise exception 'Withdrawal amount exceeds balance';
  end if;

  insert into public.withdrawals (
    user_id,
    amount,
    status,
    first_name,
    last_name,
    phone_number,
    billing_address,
    paypal_email,
    updated_at
  )
  values (
    v_user_id,
    v_amount,
    'pending',
    left(trim(p_first_name), 120),
    left(trim(p_last_name), 120),
    v_phone,
    left(trim(p_billing_address), 1000),
    left(v_paypal_email, 320),
    now()
  )
  returning id into v_request_id;

  update public.profiles
  set commission_balance = commission_balance - v_amount
  where id = v_user_id;

  return v_request_id;
end;
$$;

revoke all on function public.create_withdrawal_request(numeric,text,text,text,text,text) from public;
grant execute on function public.create_withdrawal_request(numeric,text,text,text,text,text) to authenticated;

-- ============================================================
-- 3) Customer: read own withdrawal history
-- ============================================================

create or replace function public.get_my_withdrawals()
returns table (
  id uuid,
  email text,
  amount numeric,
  status text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    w.id,
    p.email,
    w.amount,
    w.status,
    w.created_at
  from public.withdrawals w
  join public.profiles p on p.id = w.user_id
  where w.user_id = auth.uid()
  order by w.created_at desc;
$$;

revoke all on function public.get_my_withdrawals() from public;
grant execute on function public.get_my_withdrawals() to authenticated;

-- ============================================================
-- 4) Admin dashboard data - preserve current order/booking fields
--    and add the withdrawal payout information.
-- ============================================================

create or replace function public.admin_get_dashboard_data()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.admin_check_access() then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'referral_code', p.referral_code,
        'parent_referral', p.parent_referral,
        'total_commission', p.total_commission,
        'commission_balance', p.commission_balance,
        'points', p.points,
        'created_at', p.created_at
      ) order by p.created_at)
      from public.profiles p
    ), '[]'::jsonb),

    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'paypal_order_id', o.paypal_order_id,
        'buyer_email', o.buyer_email,
        'buyer_name', o.buyer_name,
        'buyer_dob', o.buyer_dob,
        'buyer_country', o.buyer_country,
        'buyer_gender', o.buyer_gender,
        'product_id', o.product_id,
        'product_name', o.product_name,
        'price', o.price,
        'payment_status', o.payment_status,
        'shipped', o.shipped,
        'verification_token', o.verification_token,
        'talisman_image_url', o.talisman_image_url,
        'talisman_image_path', o.talisman_image_path,
        'talisman_uploaded_at', o.talisman_uploaded_at,
        'created_at', o.created_at
      ) order by o.created_at desc)
      from public.orders o
    ), '[]'::jsonb),

    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'user_email', p.email,
        'booking_date', b.booking_date,
        'booking_slot', b.booking_slot,
        'duration_minutes', b.duration_minutes,
        'status', b.status,
        'phone_number', b.phone_number,
        'notes', b.notes,
        'created_at', b.created_at
      ) order by b.created_at desc)
      from public.bookings b
      join public.profiles p on p.id = b.user_id
    ), '[]'::jsonb),

    'withdrawals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id,
        'email', p.email,
        'amount', w.amount,
        'status', w.status,
        'first_name', w.first_name,
        'last_name', w.last_name,
        'phone_number', w.phone_number,
        'billing_address', w.billing_address,
        'paypal_email', w.paypal_email,
        'created_at', w.created_at,
        'updated_at', w.updated_at
      ) order by w.created_at desc)
      from public.withdrawals w
      join public.profiles p on p.id = w.user_id
    ), '[]'::jsonb),

    'commissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'order_id', c.order_id,
        'recipient_id', c.recipient_id,
        'level', c.level,
        'rate', c.rate,
        'amount', c.amount,
        'created_at', c.created_at
      ) order by c.created_at desc)
      from public.commissions c
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_get_dashboard_data() from public;
grant execute on function public.admin_get_dashboard_data() to authenticated;

-- ============================================================
-- 5) Admin: approve / mark paid / reject
--    Rejection restores reserved balance exactly once.
-- ============================================================

create or replace function public.admin_update_withdrawal_status(
  p_withdrawal_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.withdrawals%rowtype;
  v_new_status text := lower(trim(coalesce(p_status, '')));
begin
  if not public.admin_check_access() then
    raise exception 'Not authorized';
  end if;

  if v_new_status not in ('approved', 'paid', 'rejected') then
    raise exception 'Invalid withdrawal status';
  end if;

  select *
  into v_row
  from public.withdrawals
  where id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'Withdrawal not found';
  end if;

  if v_row.status in ('paid', 'rejected') then
    if v_row.status = v_new_status then
      return;
    end if;
    raise exception 'Withdrawal is already final';
  end if;

  if v_row.status = 'approved' and v_new_status = 'approved' then
    return;
  end if;

  if v_new_status = 'rejected' then
    update public.profiles
    set commission_balance = commission_balance + v_row.amount
    where id = v_row.user_id;
  end if;

  update public.withdrawals
  set status = v_new_status,
      updated_at = now()
  where id = p_withdrawal_id;
end;
$$;

revoke all on function public.admin_update_withdrawal_status(uuid,text) from public;
grant execute on function public.admin_update_withdrawal_status(uuid,text) to authenticated;
