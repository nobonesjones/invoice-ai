-- Migration to sync existing analytics data to invoice activities
-- and create a function to handle this automatically

-- First, sync existing analytics data to activities
INSERT INTO invoice_activities (
  invoice_id,
  user_id,
  activity_type,
  activity_description,
  activity_data,
  created_at,
  ip_address,
  user_agent
)
SELECT 
  ins.invoice_id,
  ins.user_id,
  CASE 
    WHEN isa.event_type = 'view' THEN 'opened'
    WHEN isa.event_type = 'download' THEN 'downloaded'
    WHEN isa.event_type = 'print' THEN 'printed'
    ELSE isa.event_type
  END as activity_type,
  CASE 
    WHEN isa.event_type = 'view' THEN 'Invoice opened via shared link from ' || COALESCE(isa.country, 'Unknown location')
    WHEN isa.event_type = 'download' THEN 'Invoice downloaded via shared link from ' || COALESCE(isa.country, 'Unknown location')
    WHEN isa.event_type = 'print' THEN 'Invoice printed via shared link from ' || COALESCE(isa.country, 'Unknown location')
    ELSE 'Invoice ' || isa.event_type || ' via shared link from ' || COALESCE(isa.country, 'Unknown location')
  END as activity_description,
  jsonb_build_object(
    'share_token', ins.share_token,
    'ip_address', isa.ip_address,
    'user_agent', isa.user_agent,
    'country', isa.country,
    'city', isa.city,
    'referrer', isa.referrer,
    'metadata', isa.metadata,
    'synced_from_analytics', true
  ) as activity_data,
  isa.created_at,
  isa.ip_address,
  isa.user_agent
FROM invoice_share_analytics isa
JOIN invoice_shares ins ON isa.share_id = ins.id
WHERE NOT EXISTS (
  -- Don't duplicate if already exists
  SELECT 1 FROM invoice_activities ia 
  WHERE ia.invoice_id = ins.invoice_id 
    AND ia.created_at = isa.created_at
    AND ia.activity_data->>'share_token' = ins.share_token
);

-- Create a function to automatically sync new analytics to activities
CREATE OR REPLACE FUNCTION sync_analytics_to_activities()
RETURNS TRIGGER AS $$
DECLARE
  invoice_record RECORD;
  share_record RECORD;
BEGIN
  -- Get the share record to find invoice and user
  SELECT * INTO share_record 
  FROM invoice_shares 
  WHERE id = NEW.share_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Get the invoice record to find user_id
  SELECT * INTO invoice_record 
  FROM invoices 
  WHERE id = share_record.invoice_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Insert corresponding activity record
  INSERT INTO invoice_activities (
    invoice_id,
    user_id,
    activity_type,
    activity_description,
    activity_data,
    created_at,
    ip_address,
    user_agent
  ) VALUES (
    share_record.invoice_id,
    invoice_record.user_id,
    CASE 
      WHEN NEW.event_type = 'view' THEN 'opened'
      WHEN NEW.event_type = 'download' THEN 'downloaded'
      WHEN NEW.event_type = 'print' THEN 'printed'
      ELSE NEW.event_type
    END,
    CASE 
      WHEN NEW.event_type = 'view' THEN 'Invoice opened via shared link from ' || COALESCE(NEW.country, 'Unknown location')
      WHEN NEW.event_type = 'download' THEN 'Invoice downloaded via shared link from ' || COALESCE(NEW.country, 'Unknown location')
      WHEN NEW.event_type = 'print' THEN 'Invoice printed via shared link from ' || COALESCE(NEW.country, 'Unknown location')
      ELSE 'Invoice ' || NEW.event_type || ' via shared link from ' || COALESCE(NEW.country, 'Unknown location')
    END,
    jsonb_build_object(
      'share_token', share_record.share_token,
      'ip_address', NEW.ip_address,
      'user_agent', NEW.user_agent,
      'country', NEW.country,
      'city', NEW.city,
      'referrer', NEW.referrer,
      'metadata', NEW.metadata,
      'auto_synced', true
    ),
    NEW.created_at,
    NEW.ip_address,
    NEW.user_agent
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically sync new analytics
DROP TRIGGER IF EXISTS trigger_sync_analytics_to_activities ON invoice_share_analytics;
CREATE TRIGGER trigger_sync_analytics_to_activities
  AFTER INSERT ON invoice_share_analytics
  FOR EACH ROW
  EXECUTE FUNCTION sync_analytics_to_activities();

-- Add comment
COMMENT ON FUNCTION sync_analytics_to_activities() IS 'Automatically syncs invoice share analytics to invoice activities for unified history tracking'; 