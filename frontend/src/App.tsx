import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { PresenceProvider } from './hooks/usePresence';
import { ChatNotificationsProvider } from './hooks/useChatNotifications';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfileEditPage } from './pages/ProfileEditPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { MatchingPage } from './pages/MatchingPage';
import { GamePage } from './pages/GamePage';
import { MatchHistoryPage } from './pages/MatchHistoryPage';
import { RankingPage } from './pages/RankingPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { FriendsPage } from './pages/FriendsPage';
import { PlayPage } from './pages/PlayPage';
import { ChatPage } from './pages/ChatPage';
import { TournamentListPage } from './pages/TournamentListPage';
import { TournamentDetailPage } from './pages/TournamentDetailPage';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="font-display text-cosmic-cyan text-glow-cyan text-xl animate-glow-pulse">
          Loading...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/terms" element={<Layout><TermsPage /></Layout>} />
      <Route path="/privacy" element={<Layout><PrivacyPage /></Layout>} />

      {/* Protected routes with Layout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout><DashboardPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/edit"
        element={
          <ProtectedRoute>
            <Layout><ProfileEditPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/user/:id"
        element={
          <ProtectedRoute>
            <Layout><UserProfilePage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/play"
        element={
          <ProtectedRoute>
            <Layout><PlayPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/matching"
        element={
          <ProtectedRoute>
            <Layout><MatchingPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/game/:id"
        element={
          <ProtectedRoute>
            <Layout><GamePage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <Layout><MatchHistoryPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ranking"
        element={
          <ProtectedRoute>
            <Layout><RankingPage /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/friends"
        element={
          <ProtectedRoute>
            <Layout><FriendsPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Layout><ChatPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/:userId"
        element={
          <ProtectedRoute>
            <Layout><ChatPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tournaments"
        element={
          <ProtectedRoute>
            <Layout><TournamentListPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tournaments/:id"
        element={
          <ProtectedRoute>
            <Layout><TournamentDetailPage /></Layout>
          </ProtectedRoute>
        }
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PresenceProvider>
        <ChatNotificationsProvider>
          <AppRoutes />
        </ChatNotificationsProvider>
      </PresenceProvider>
    </AuthProvider>
  );
}
