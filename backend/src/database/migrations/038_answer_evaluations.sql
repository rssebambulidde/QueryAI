-- Migration 038: Create answer_evaluations table for LLM-as-judge quality validation
-- Stores structured evaluation scores (faithfulness, relevance, citation_accuracy)
-- from GPT-4o-mini acting as an automated quality judge on a sampled subset of queries.

BEGIN;

-- ── 1. Create the answer_evaluations table ─────────────────────────
CREATE TABLE IF NOT EXISTS public.answer_evaluations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid,
  topic_id      uuid,

  question      text NOT NULL,
  answer        text NOT NULL,
  sources_snapshot jsonb DEFAULT '[]'::jsonb,

  -- Scores 1–5 from LLM judge
  faithfulness      smallint NOT NULL CHECK (faithfulness BETWEEN 1 AND 5),
  relevance         smallint NOT NULL CHECK (relevance BETWEEN 1 AND 5),
  citation_accuracy smallint NOT NULL CHECK (citation_accuracy BETWEEN 1 AND 5),

  evaluator_model   text NOT NULL DEFAULT 'gpt-4o-mini',
  evaluation_reason jsonb,       -- per-dimension rationale from the judge

  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Indexes ─────────────────────────────────────────────────────
CREATE INDEX idx_answer_evaluations_user_id    ON public.answer_evaluations (user_id);
CREATE INDEX idx_answer_evaluations_created_at ON public.answer_evaluations (created_at DESC);
CREATE INDEX idx_answer_evaluations_topic_id   ON public.answer_evaluations (topic_id);

-- ── 3. RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.answer_evaluations ENABLE ROW LEVEL SECURITY;

-- Service-role (backend) can do everything
CREATE POLICY "service_role_all" ON public.answer_evaluations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── 4. Aggregation RPC (admin dashboard) ───────────────────────────
CREATE OR REPLACE FUNCTION private.get_evaluation_aggregates(
  p_days integer DEFAULT 30,
  p_group_by text DEFAULT 'day'
)
RETURNS TABLE (
  period           text,
  evaluation_count bigint,
  avg_faithfulness numeric,
  avg_relevance    numeric,
  avg_citation_accuracy numeric,
  avg_overall      numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE p_group_by
      WHEN 'week' THEN to_char(date_trunc('week', ae.created_at), 'YYYY-"W"IW')
      WHEN 'month' THEN to_char(date_trunc('month', ae.created_at), 'YYYY-MM')
      ELSE to_char(ae.created_at::date, 'YYYY-MM-DD')
    END AS period,
    count(*)::bigint AS evaluation_count,
    round(avg(ae.faithfulness)::numeric, 2) AS avg_faithfulness,
    round(avg(ae.relevance)::numeric, 2) AS avg_relevance,
    round(avg(ae.citation_accuracy)::numeric, 2) AS avg_citation_accuracy,
    round(((avg(ae.faithfulness) + avg(ae.relevance) + avg(ae.citation_accuracy)) / 3.0)::numeric, 2) AS avg_overall
  FROM public.answer_evaluations ae
  WHERE ae.created_at >= (now() - (p_days || ' days')::interval)
  GROUP BY 1
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION private.get_evaluation_aggregates(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_evaluation_aggregates(integer, text) TO service_role;

COMMIT;
