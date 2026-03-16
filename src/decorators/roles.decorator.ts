import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants';

/** Restrict access to users with one of the specified roles */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
