import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../constants';

/** Restrict access to users with ALL of the specified permissions */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
