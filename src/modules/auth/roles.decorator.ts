import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'required_roles';
export const Roles = (...roles: Array<'ADMIN' | 'USER'>) =>
  SetMetadata(ROLES_KEY, roles);
