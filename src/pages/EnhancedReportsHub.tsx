import ReportsHub from './ReportsHub';

interface EnhancedReportsHubProps {
  projectId: string;
  projects: any[];
  onNavigateBackToScope: () => void;
  onNavigateBackToDashboard: () => void;
}

export default function EnhancedReportsHub(props: EnhancedReportsHubProps) {
  return <ReportsHub {...props} />;
}
