'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const TokenExpiryWarning: React.FC = () => {
  const { tokenExpiryTime, refreshAuthToken, isAuthenticated } = useAuthStore();
  const { isMobile } = useMobile();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    if (!isAuthenticated || !tokenExpiryTime) {
      setShowWarning(false);
      return;
    }

    const checkExpiry = () => {
      const now = Date.now();
      const timeUntilExpiry = tokenExpiryTime - now;
      const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

      if (timeUntilExpiry > 0 && timeUntilExpiry <= fiveMinutes) {
        setShowWarning(true);
        setTimeRemaining(Math.ceil(timeUntilExpiry / 1000 / 60)); // Minutes remaining
      } else {
        setShowWarning(false);
      }
    };

    // Check immediately
    checkExpiry();

    // Check every 30 seconds
    const interval = setInterval(checkExpiry, 30000);

    return () => clearInterval(interval);
  }, [tokenExpiryTime, isAuthenticated]);

  const handleRefresh = async () => {
    const success = await refreshAuthToken();
    if (success) {
      setShowWarning(false);
    }
  };

  if (!showWarning) return null;

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 p-4",
      isMobile && "pb-safe-area-inset-bottom"
    )}>
      <Alert
        variant="warning"
        className={cn(
          "max-w-2xl mx-auto shadow-lg border-2 border-yellow-400",
          isMobile && "p-3"
        )}
      >
        <div className={cn(
          "flex items-start gap-3",
          isMobile ? "flex-col" : "flex-row"
        )}>
          <AlertTriangle className={cn(
            "text-yellow-600 flex-shrink-0",
            isMobile ? "w-5 h-5" : "w-6 h-6"
          )} />
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "font-semibold text-yellow-900 mb-1",
              isMobile ? "text-sm" : "text-base"
            )}>
              Your session is about to expire
            </h3>
            <p className={cn(
              "text-yellow-800",
              isMobile ? "text-xs" : "text-sm"
            )}>
              Your session will expire in {timeRemaining} minute{timeRemaining !== 1 ? 's' : ''}. 
              Click "Refresh Session" to stay logged in.
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            size="sm"
            className={cn(
              "bg-yellow-600 hover:bg-yellow-700 text-white flex-shrink-0",
              isMobile && "w-full min-h-[44px] text-base"
            )}
          >
            <RefreshCw className={cn(
              "mr-2",
              isMobile ? "w-4 h-4" : "w-3.5 h-3.5"
            )} />
            Refresh Session
          </Button>
        </div>
      </Alert>
    </div>
  );
};
