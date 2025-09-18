import * as AuthSession from 'expo-auth-session';

// Generate the correct redirect URI for the current runtime
export const OAUTH_REDIRECT = AuthSession.makeRedirectUri({
  scheme: 'superinvoice',
  path: 'oauth/callback',
});

