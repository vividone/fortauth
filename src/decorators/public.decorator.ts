import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants';

/** Mark a route as public — bypasses FortAuthGuard */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
