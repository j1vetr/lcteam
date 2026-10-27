import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { useGetSession, getGetSessionQueryKey } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorState } from '@/components/bits';
import { AppShell } from '@/components/shell';
import NotFound from '@/pages/not-found';
import LoginPage from '@/pages/login';
import BoardPage from '@/pages/board';
import OverviewPage from '@/pages/overview';
import MyTasksPage from '@/pages/my-tasks';
import TeamsPage from '@/pages/teams';
import NotificationsPage from '@/pages/notifications';
import SettingsPage from '@/pages/settings';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });

function Gate() {
  const { data, isLoading, isError, refetch } = useGetSession({ query: { queryKey: getGetSessionQueryKey() } });
  const [loc, navigate] = useLocation();
  const user = data?.user;

  useEffect(() => {
    if (!data) return;
    if (!user && loc !== '/login') navigate('/login', { replace: true });
    if (user && loc === '/login') navigate('/', { replace: true });
  }, [data, user, loc, navigate]);

  if (isLoading)
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-card">
        <img src={`${import.meta.env.BASE_URL}logo-navy.png`} alt="Lacivert Teknoloji" className="h-7 w-auto animate-pulse" />
      </div>
    );
  if (isError || !data) return <div className="mx-auto max-w-md p-8"><ErrorState onRetry={() => refetch()} text="Sunucuya ulaşılamadı." /></div>;
  if (!user) return <LoginPage needsSetup={data.needsSetup} />;

  return (
    <AppShell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={BoardPage} />
          <Route path="/boards/:id" component={BoardPage} />
          <Route path="/overview" component={OverviewPage} />
          <Route path="/my-tasks" component={MyTasksPage} />
          <Route path="/teams" component={TeamsPage} />
          <Route path="/notifications" component={NotificationsPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/login" component={BoardPage} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </AppShell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Gate />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
