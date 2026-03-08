
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'vendor' THEN 2
      WHEN 'rider' THEN 3
      WHEN 'student' THEN 4
    END
  LIMIT 1
$function$
