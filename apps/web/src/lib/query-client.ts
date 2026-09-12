'use client';

import { QueryClient } from '@tanstack/react-query';

export const getQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: (failureCount, error) => {
          // Do not retry authorization/authentication errors
          if (error && typeof error === 'object' && 'code' in error) {
            const apiError = error as { code: string };
            if (apiError.code === 'UNAUTHORIZED' || apiError.code === 'FORBIDDEN') {
              return false;
            }
          }
          return failureCount < 3;
        },
      },
    },
  });
};
