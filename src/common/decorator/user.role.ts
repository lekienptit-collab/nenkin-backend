import { SetMetadata } from '@nestjs/common';

/**
 * Khai báo permission cần có để gọi route. Chỉ cần thoả 1 trong các permission.
 */
export const CUseRoles = (...roles: string[]) => SetMetadata('roles', roles);
