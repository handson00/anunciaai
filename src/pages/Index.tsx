import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { WelcomeModal } from '@/components/WelcomeModal';
import logo from '@/assets/logo.png';

export default function Index() {
  const { currentUser, loading } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <img src={logo} alt="anunciaAI" className="w-16 h-16 mx-auto" />
          <h1 className="text-2xl font-bold">
            <span className="text-cta">Anuncia</span>AI
          </h1>
          <div className="w-8 h-8 border-2 border-cta border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (currentUser) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <WelcomeModal />
    </div>
  );
}
