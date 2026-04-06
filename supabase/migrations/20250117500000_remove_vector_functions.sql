-- Migration to remove all vector-related functions and extensions from the database
-- This migration removes the vector extension and all associated functions

-- Drop the match_documents function first (it references documents table)
DROP FUNCTION IF EXISTS "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb");

-- Drop the vector extension (this will automatically remove all vector-related functions)
-- Note: This will remove all vector functions including:
-- - vector_in, vector_out, vector_recv, vector_send
-- - array_to_vector functions
-- - vector_to_float4
-- - cosine_distance, inner_product, l2_distance
-- - vector_accum, vector_add, vector_avg, vector_cmp, vector_combine
-- - vector_dims, vector_eq, vector_ge, vector_gt, vector_le, vector_lt, vector_ne
-- - vector_negative_inner_product, vector_norm, vector_spherical_distance
-- - vector_sub, vector_l2_squared_distance
-- - ivfflathandler
-- - avg function for vectors
-- - All vector operators and types
DROP EXTENSION IF EXISTS "vector";

-- Note: If there was a documents table, it would need to be dropped here as well
-- However, based on the schema analysis, there doesn't appear to be a documents table
-- in the current schema, so we don't need to drop it
