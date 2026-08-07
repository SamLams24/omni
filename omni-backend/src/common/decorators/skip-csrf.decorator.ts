import { SetMetadata } from '@nestjs/common';

export const SKIP_CSRF_KEY = 'skipCsrf';

/** For routes authenticated by something other than cookies (e.g. HMAC-signed webhooks). */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
