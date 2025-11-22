-- Get top 30 most active clients with their current trades
SELECT 
  o.name as company_name,
  o.licensed_trades,
  o.subscription_status,
  o.trial_end_date,
  COUNT(DISTINCT p.id) as total_projects,
  COUNT(DISTINCT q.id) as total_quotes,
  MAX(q.created_at) as last_quote_upload,
  ARRAY_AGG(DISTINCT u.email) FILTER (WHERE u.email IS NOT NULL) as user_emails
FROM organisations o
LEFT JOIN projects p ON p.organisation_id = o.id
LEFT JOIN quotes q ON q.project_id = p.id
LEFT JOIN organisation_members om ON om.organisation_id = o.id
LEFT JOIN auth.users u ON u.id = om.user_id
WHERE o.id != '00000000-0000-0000-0000-000000000000' -- Exclude system org
GROUP BY o.id, o.name, o.licensed_trades, o.subscription_status, o.trial_end_date
HAVING COUNT(DISTINCT q.id) > 0 -- Must have uploaded quotes
ORDER BY 
  MAX(q.created_at) DESC NULLS LAST,
  COUNT(DISTINCT q.id) DESC
LIMIT 30;
