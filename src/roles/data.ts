import {
  PERMISSION_ALL,
  PermissionGroup,
  RolePers,
} from 'src/common/constatns/role';
import { RoleEntity } from 'src/entities/role.entity';

/**
 * Role mặc định được seed lần chạy đầu tiên.
 * admin -> manager -> member
 */
export const roleData: RoleEntity[] = [
  {
    id: 1,
    name: 'Quản trị hệ thống',
    slug: 'admin',
    permissions: [PERMISSION_ALL],
    isCanEdit: false,
    isActive: true,
  },
  {
    id: 2,
    name: 'Quản lý',
    slug: 'manager',
    permissions: [
      ...PermissionGroup.USER,
      ...PermissionGroup.ROLES,
      ...PermissionGroup.WORKER,
      ...PermissionGroup.AGENT,
      ...PermissionGroup.NENKIN_SERVICE,
    ],
    isCanEdit: false,
    isActive: true,
    roleId: 1,
  },
  {
    id: 3,
    name: 'Thành viên',
    slug: 'member',
    permissions: [
      RolePers.GET_USER,
      ...PermissionGroup.WORKER,
      ...PermissionGroup.AGENT,
      ...PermissionGroup.NENKIN_SERVICE,
    ],
    isCanEdit: false,
    isActive: true,
    roleId: 2,
  },
];
