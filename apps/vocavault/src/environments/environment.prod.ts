import { Environment } from '@vocavault/data-access';

export const environment: Environment = {
  envName: 'prod',
  production: true,
  apiBaseUrl: 'https://api.vocavault.local',
  persistenceMode: 'action',
  sentryDsn: 'https://262658e5b74eb272f1ad45a6eccae598@o4511416790417408.ingest.de.sentry.io/4511416879349840',
};
