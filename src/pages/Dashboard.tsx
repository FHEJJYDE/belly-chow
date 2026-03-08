import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import StudentDashboard from '@/components/dashboards/StudentDashboard';
import RiderDashboard from '@/components/dashboards/RiderDashboard';

const Dashboard = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  switch (role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'vendor':
      return <Navigate to="/vendor-panel" replace />;
    case 'rider':
      return <RiderDashboard />;
    default:
      return <StudentDashboard />;
  }
};

export default Dashboard;
