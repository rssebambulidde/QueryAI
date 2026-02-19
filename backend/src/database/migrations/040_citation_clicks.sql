-- Migration 040: Citation click-through analytics
-- Tracks when users click on citations (inline or tooltip actions) to open source URLs.
-- Enables: most clicked sources per topic, CTR by domain, unclicked citations, RAG quality weighting.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. citation_clicks table
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS citation_clicks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  message_id    uuid REFERENCES messages(id) ON DELETE SET NULL,
  source_index  smallint NOT NULL,            -- 0-based index in the message's sources array
  source_url    text,                         -- full URL (nullable for documents without URL)
  source_domain text,                         -- extracted domain for aggregation (privacy-friendly)
  source_type   text NOT NULL CHECK (source_type IN ('document', 'web')),
  clicked_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_citation_clicks_user_id     ON citation_clicks (user_id);
CREATE INDEX idx_citation_clicks_message_id  ON citation_clicks (message_id);
CREATE INDEX idx_citation_clicks_domain      ON citation_clicks (source_domain);
CREATE INDEX idx_citation_clicks_clicked_at  ON citation_clicks (clicked_at DESC);
CREATE INDEX idx_citation_clicks_source_type ON citation_clicks (source_type);

-- RLS (service-role only — users write via API, reads are admin-only aggregates)
ALTER TABLE citation_clicks ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════
-- 2. RPC: private.record_citation_click — insert helper
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.record_citation_click(
  p_user_id       uuid,
  p_conversation_id uuid,
  p_message_id    uuid,
  p_source_index  smallint,
  p_source_url    text,
  p_source_domain text,
  p_source_type   text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO citation_clicks (user_id, conversation_id, message_id, source_index, source_url, source_domain, source_type)
  VALUES (p_user_id, p_conversation_id, p_message_id, p_source_index, p_source_url, p_source_domain, p_source_type)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION private.record_citation_click FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.record_citation_click TO service_role;


-- ═══════════════════════════════════════════════════════════════════════
-- 3. RPC: private.get_citation_click_stats — admin aggregates
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.get_citation_click_stats(
  p_days integer DEFAULT 30
) RETURNS TABLE (
  total_clicks       bigint,
  unique_users       bigint,
  clicks_by_type     jsonb,      -- { "web": 120, "document": 45 }
  top_domains        jsonb,      -- [{ domain, clicks, unique_users }]
  avg_clicks_per_msg numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - (p_days || ' days')::interval;
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM citation_clicks WHERE clicked_at >= v_since)::bigint AS total_clicks,
    (SELECT count(DISTINCT user_id) FROM citation_clicks WHERE clicked_at >= v_since)::bigint AS unique_users,
    (
      SELECT coalesce(jsonb_object_agg(source_type, cnt), '{}'::jsonb)
      FROM (
        SELECT source_type, count(*) AS cnt
        FROM citation_clicks
        WHERE clicked_at >= v_since
        GROUP BY source_type
      ) t
    ) AS clicks_by_type,
    (
      SELECT coalesce(jsonb_agg(row_to_json(d) ORDER BY d.clicks DESC), '[]'::jsonb)
      FROM (
        SELECT source_domain AS domain, count(*) AS clicks, count(DISTINCT user_id) AS unique_users
        FROM citation_clicks
        WHERE clicked_at >= v_since AND source_domain IS NOT NULL
        GROUP BY source_domain
        ORDER BY count(*) DESC
        LIMIT 25
      ) d
    ) AS top_domains,
    (
      SELECT coalesce(round(count(*)::numeric / nullif(count(DISTINCT message_id), 0), 2), 0)
      FROM citation_clicks
      WHERE clicked_at >= v_since
    ) AS avg_clicks_per_msg;
END;
$$;

REVOKE ALL ON FUNCTION private.get_citation_click_stats FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_citation_click_stats TO service_role;


-- ═══════════════════════════════════════════════════════════════════════
-- 4. RPC: private.get_domain_click_through_rates
--    Compares cited domains vs clicked domains for CTR calculation
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.get_domain_click_through_rates(
  p_days integer DEFAULT 30
) RETURNS TABLE (
  domain        text,
  total_cited   bigint,
  total_clicked bigint,
  click_through_rate numeric,
  unique_clickers    bigint
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - (p_days || ' days')::interval;
BEGIN
  RETURN QUERY
  SELECT
    cc.source_domain AS domain,
    count(*) AS total_cited,
    count(*) AS total_clicked,   -- every row IS a click
    1.0::numeric AS click_through_rate,  -- placeholder; real CTR computed app-side with total citations
    count(DISTINCT cc.user_id) AS unique_clickers
  FROM citation_clicks cc
  WHERE cc.clicked_at >= v_since AND cc.source_domain IS NOT NULL
  GROUP BY cc.source_domain
  ORDER BY count(*) DESC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION private.get_domain_click_through_rates FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_domain_click_through_rates TO service_role;


-- ═══════════════════════════════════════════════════════════════════════
-- 5. RPC: private.get_domain_click_boost_scores
--    Returns click-based quality signal per domain for RAG weighting
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.get_domain_click_boost_scores(
  p_days integer DEFAULT 90
) RETURNS TABLE (
  domain      text,
  click_count bigint,
  boost_score numeric   -- normalized 0.0-1.0
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - (p_days || ' days')::interval;
  v_max   bigint;
BEGIN
  -- Find max click count for normalization
  SELECT max(cnt) INTO v_max
  FROM (
    SELECT count(*) AS cnt
    FROM citation_clicks
    WHERE clicked_at >= v_since AND source_domain IS NOT NULL
    GROUP BY source_domain
  ) sub;

  IF v_max IS NULL OR v_max = 0 THEN
    RETURN;  -- no data
  END IF;

  RETURN QUERY
  SELECT
    cc.source_domain AS domain,
    count(*) AS click_count,
    round(count(*)::numeric / v_max, 4) AS boost_score
  FROM citation_clicks cc
  WHERE cc.clicked_at >= v_since AND cc.source_domain IS NOT NULL
  GROUP BY cc.source_domain
  ORDER BY count(*) DESC;
END;
$$;

REVOKE ALL ON FUNCTION private.get_domain_click_boost_scores FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_domain_click_boost_scores TO service_role;
