-- Add column to mark the group used for join links
ALTER TABLE public.community_groups 
ADD COLUMN is_join_group_link BOOLEAN DEFAULT false;

-- Create function to ensure only one group is marked as join link
CREATE OR REPLACE FUNCTION public.ensure_single_join_group_link()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_join_group_link = true THEN
    UPDATE public.community_groups 
    SET is_join_group_link = false 
    WHERE id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for the join link constraint
CREATE TRIGGER tr_single_join_group_link
BEFORE INSERT OR UPDATE OF is_join_group_link ON public.community_groups
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_join_group_link();
