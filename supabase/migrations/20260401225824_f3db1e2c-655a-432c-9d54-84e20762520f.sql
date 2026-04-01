
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _url text;
BEGIN
  _url := current_setting('app.settings.supabase_url', true);
  IF _url IS NULL OR _url = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := _url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', NEW.message,
      'data', jsonb_build_object('order_id', NEW.order_id, 'type', NEW.type, 'url', '/orders')
    )
  );
  RETURN NEW;
END;
$function$;
