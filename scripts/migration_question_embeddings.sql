-- Migration: Add question_embedding to conversations for similar question detection
-- Run this in your Supabase SQL editor

-- 1. Add question_embedding column to conversations table
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS question_embedding vector(512);

-- 2. Create index for fast similarity search on question embeddings
CREATE INDEX IF NOT EXISTS conversations_question_embedding_idx
  ON conversations
  USING ivfflat (question_embedding vector_cosine_ops)
  WITH (lists = 100);

-- 3. RPC to store question embedding on the latest user message
CREATE OR REPLACE FUNCTION store_question_embedding(
  p_session_id text,
  p_question text,
  p_embedding vector(512)
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversations
  SET question_embedding = p_embedding
  WHERE session_id = p_session_id
    AND role = 'user'
    AND content = p_question
    AND question_embedding IS NULL
  ;
END;
$$;

-- 4. RPC to find similar past questions with their answers
CREATE OR REPLACE FUNCTION match_questions(
  query_embedding vector(512),
  match_threshold float,
  match_count int,
  exclude_session_id text DEFAULT ''
)
RETURNS TABLE (
  session_id text,
  content text,
  answer text,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.session_id,
    q.content,
    COALESCE(a.content, '') AS answer,
    q.created_at,
    1 - (q.question_embedding <=> query_embedding) AS similarity
  FROM conversations q
  LEFT JOIN LATERAL (
    -- Get the assistant reply immediately after this user message
    SELECT content
    FROM conversations a2
    WHERE a2.session_id = q.session_id
      AND a2.role = 'assistant'
      AND a2.created_at > q.created_at
    ORDER BY a2.created_at ASC
    LIMIT 1
  ) a ON true
  WHERE q.role = 'user'
    AND q.question_embedding IS NOT NULL
    AND (exclude_session_id = '' OR q.session_id != exclude_session_id)
    AND 1 - (q.question_embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Reflection columns (add to same migration or run separately)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS reflection_score integer,
  ADD COLUMN IF NOT EXISTS reflection_critique text;
