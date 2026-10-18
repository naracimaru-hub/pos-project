CREATE OR REPLACE FUNCTION public.create_store(p_name text)
RETURNS public.stores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_store public.stores;
  v_name text;
  v_base_slug text;
  v_slug text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_name := btrim(coalesce(p_name, ''));
  IF char_length(v_name) < 2 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'Nama toko harus 2-100 karakter';
  END IF;

  v_base_slug := btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
  IF v_base_slug = '' THEN
    v_base_slug := 'toko';
  END IF;

  v_slug := left(v_base_slug, 48) || '-' ||
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO public.stores(name, slug, created_by)
  VALUES (v_name, v_slug, auth.uid())
  RETURNING * INTO v_store;

  INSERT INTO public.store_members(store_id, user_id, role)
  VALUES (v_store.id, auth.uid(), 'owner');

  RETURN v_store;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_store(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_store(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_store(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.checkout_sale(
  p_store_id uuid,
  p_items jsonb,
  p_discount numeric,
  p_tax_rate numeric,
  p_payment_method text,
  p_cash_received numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_item_count integer;
  v_missing_count integer;
  v_updated_count integer;
  v_subtotal numeric;
  v_discount numeric;
  v_tax numeric;
  v_total numeric;
  v_cash_received numeric;
  v_change_amount numeric;
  v_receipt_number text;
  v_product_name text;
  v_stock integer;
  v_requested integer;
  v_sale public.sales;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  PERFORM 1
  FROM public.store_members AS sm
  WHERE sm.store_id = p_store_id
    AND sm.user_id = v_user_id
  FOR SHARE;

  IF p_store_id IS NULL OR NOT FOUND THEN
    RAISE EXCEPTION 'You are not a member of this store';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Checkout items must be a JSON array';
  END IF;

  IF jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'Checkout must contain between 1 and 100 items';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer)
    WHERE item.product_id IS NULL
       OR item.quantity IS NULL
       OR item.quantity < 1
  ) THEN
    RAISE EXCEPTION 'Each checkout item must have a product_id and positive quantity';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer)
    GROUP BY item.product_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'A product may only appear once in checkout items';
  END IF;

  IF p_discount IS NULL OR p_discount < 0
     OR p_discount::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_tax_rate IS NULL OR p_tax_rate < 0 OR p_tax_rate > 100
     OR p_tax_rate::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Discount or tax rate is invalid';
  END IF;

  IF p_payment_method IS NULL OR p_payment_method NOT IN ('Tunai', 'Transfer', 'QRIS') THEN
    RAISE EXCEPTION 'Payment method is invalid';
  END IF;

  SELECT count(*)
  INTO v_missing_count
  FROM jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer)
  LEFT JOIN public.products AS product
    ON product.id = item.product_id
   AND product.store_id = p_store_id
  WHERE product.id IS NULL;

  IF v_missing_count > 0 THEN
    RAISE EXCEPTION 'One or more products do not belong to this store';
  END IF;

  PERFORM product.id
  FROM public.products AS product
  JOIN jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer)
    ON item.product_id = product.id
  WHERE product.store_id = p_store_id
  ORDER BY product.id
  FOR UPDATE OF product;

  SELECT product.name, product.stock, item.quantity
  INTO v_product_name, v_stock, v_requested
  FROM public.products AS product
  JOIN jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer)
    ON item.product_id = product.id
  WHERE product.store_id = p_store_id
    AND product.stock < item.quantity
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Insufficient stock for product "%": available %, requested %',
      v_product_name, v_stock, v_requested;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.products AS product
    JOIN jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer)
      ON item.product_id = product.id
    WHERE product.store_id = p_store_id
      AND (product.price IS NULL
        OR product.stock IS NULL
        OR product.price < 0
        OR product.price::text IN ('NaN', 'Infinity', '-Infinity')
        OR product.stock < 0)
  ) THEN
    RAISE EXCEPTION 'Product price or stock is invalid';
  END IF;

  SELECT coalesce(sum(product.price * item.quantity), 0)
  INTO v_subtotal
  FROM public.products AS product
  JOIN jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer)
    ON item.product_id = product.id
  WHERE product.store_id = p_store_id;

  IF p_discount > v_subtotal THEN
    RAISE EXCEPTION 'Discount cannot exceed subtotal';
  END IF;

  v_discount := p_discount;
  v_tax := round(((v_subtotal - v_discount) * p_tax_rate) / 100);
  v_total := v_subtotal - v_discount + v_tax;

  IF p_payment_method = 'Tunai' THEN
    IF p_cash_received IS NULL
       OR p_cash_received::text IN ('NaN', 'Infinity', '-Infinity')
       OR p_cash_received < v_total THEN
      RAISE EXCEPTION 'Cash received is less than total';
    END IF;
    v_cash_received := p_cash_received;
    v_change_amount := p_cash_received - v_total;
  ELSE
    v_cash_received := v_total;
    v_change_amount := 0;
  END IF;

  v_receipt_number := 'TRX-' ||
    upper(replace(gen_random_uuid()::text, '-', ''));

  INSERT INTO public.sales(
    store_id,
    receipt_number,
    cashier_id,
    subtotal,
    discount,
    tax,
    total,
    payment_method,
    cash_received,
    change_amount
  )
  VALUES (
    p_store_id,
    v_receipt_number,
    v_user_id,
    v_subtotal,
    v_discount,
    v_tax,
    v_total,
    p_payment_method,
    v_cash_received,
    v_change_amount
  )
  RETURNING * INTO v_sale;

  INSERT INTO public.sale_items(
    sale_id,
    store_id,
    product_id,
    product_name,
    sku,
    quantity,
    unit_price,
    line_total
  )
  SELECT
    v_sale.id,
    p_store_id,
    product.id,
    product.name,
    product.sku,
    item.quantity,
    product.price,
    product.price * item.quantity
  FROM public.products AS product
  JOIN jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer)
    ON item.product_id = product.id
  WHERE product.store_id = p_store_id;

  UPDATE public.products AS product
  SET stock = product.stock - item.quantity,
      updated_at = now()
  FROM jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer)
  WHERE product.id = item.product_id
    AND product.store_id = p_store_id
    AND product.stock >= item.quantity;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  v_item_count := jsonb_array_length(p_items);
  IF v_updated_count <> v_item_count THEN
    RAISE EXCEPTION 'Stock changed during checkout; transaction cancelled';
  END IF;

  RETURN to_jsonb(v_sale) || jsonb_build_object(
    'items',
    coalesce(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'product_id', sale_item.product_id,
          'product_name', sale_item.product_name,
          'sku', sale_item.sku,
          'quantity', sale_item.quantity,
          'unit_price', sale_item.unit_price,
          'line_total', sale_item.line_total
        ))
        FROM public.sale_items AS sale_item
        WHERE sale_item.sale_id = v_sale.id
          AND sale_item.store_id = p_store_id
      ),
      '[]'::jsonb
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.checkout_sale(uuid, jsonb, numeric, numeric, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkout_sale(uuid, jsonb, numeric, numeric, text, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.checkout_sale(uuid, jsonb, numeric, numeric, text, numeric) FROM service_role;
GRANT EXECUTE ON FUNCTION public.checkout_sale(uuid, jsonb, numeric, numeric, text, numeric) TO authenticated;
