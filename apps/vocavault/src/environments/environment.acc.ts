import { Environment } from '@vocavault/data-access';

export const environment: Environment = {
  envName: 'acc',
  production: true,
  apiBaseUrl: 'https://acc.api.vocavault.local',
  persistenceMode: 'action',
  sentryDsn: '',
};
