-- Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'courses_likes' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.courses_likes ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE;
    END IF;
END
$$;

-- Enable RLS on courses_likes table
ALTER TABLE public.courses_likes ENABLE ROW LEVEL SECURITY;

-- Policy that allows users to only see their own liked courses
CREATE POLICY "Users can view only their own liked courses" 
ON public.courses_likes
FOR SELECT
USING (auth.uid() = user_id);

-- Policy that allows users to insert their own likes only
CREATE POLICY "Users can insert only their own likes"
ON public.courses_likes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy that allows users to delete only their own likes
CREATE POLICY "Users can delete only their own likes"
ON public.courses_likes
FOR DELETE
USING (auth.uid() = user_id);
