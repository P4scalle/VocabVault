import { bootstrapApplication } from '@angular/platform-browser';
import * as Sentry from '@sentry/angular';
import { environment } from './environments/environment';
import { sentryBeforeSend } from './sentry-config';
import { appConfig } from './app/app.config';
import { App } from './app/app';

Sentry.init({
  dsn: environment.sentryDsn || undefined,
  environment: environment.envName,
  enabled: !!environment.sentryDsn,
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  tracePropagationTargets: ['localhost', /^https:\/\/vocavault\.vercel\.app\/api/],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
  beforeSend: sentryBeforeSend,
});

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
