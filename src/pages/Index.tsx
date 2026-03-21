import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { WelcomeModal } from '@/components/WelcomeModal';

export default function Index() {
  const { currentUser } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  if (currentUser) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <WelcomeModal />
    </div>
  );
}
