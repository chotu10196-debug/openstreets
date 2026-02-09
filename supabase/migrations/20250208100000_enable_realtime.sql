-- Enable Supabase Realtime on key tables
-- This allows clients to subscribe to INSERT/UPDATE/DELETE events

-- Enable realtime for predictions table (new predictions appearing live)
ALTER PUBLICATION supabase_realtime ADD TABLE predictions;

-- Enable realtime for theses table (new theses appearing live)
ALTER PUBLICATION supabase_realtime ADD TABLE theses;

-- Enable realtime for thesis_votes table (upvote counts updating live)
ALTER PUBLICATION supabase_realtime ADD TABLE thesis_votes;

-- Enable realtime for consensus_prices table (consensus updates live)
ALTER PUBLICATION supabase_realtime ADD TABLE consensus_prices;

-- Enable realtime for agents table (new agent registrations)
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
