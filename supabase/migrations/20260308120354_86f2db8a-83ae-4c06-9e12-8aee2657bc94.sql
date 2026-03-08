ALTER TABLE public.platform_settings
ADD COLUMN bank_name text NOT NULL DEFAULT '',
ADD COLUMN bank_account_name text NOT NULL DEFAULT '',
ADD COLUMN bank_account_number text NOT NULL DEFAULT '';