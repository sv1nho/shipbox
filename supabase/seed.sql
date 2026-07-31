-- stripe_price_id values are placeholders until the real Stripe Products exist.
insert into plans (id, quota, price_cents, stripe_price_id, active) values
  ('plan_5', 5, 500, 'price_1TzLcVPnzRocKiht7eI2zVau', true),
  ('plan_10', 10, 750, 'price_1TzLcjPnzRocKihtBlXvFymF', true),
  ('plan_20', 20, 1000, 'price_1TzLcuPnzRocKihtHTKvXoOA', true)
on conflict (id) do nothing;
