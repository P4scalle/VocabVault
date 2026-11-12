import { Environment } from '@vocavault/data-access';

export const environment: Environment = {
  envName: 'dev',
  production: false,
  apiBaseUrl: 'http://localhost:3000/api',
  persistenceMode: 'action',
  sentryDsn: '',
};
