/**
 * Danh sách permission của hệ thống.
 * Base project chỉ giữ nhóm Thành viên + Quyền; thêm nhóm mới thì
 * khai báo ở đây rồi bổ sung vào PermissionGroup bên dưới.
 */
export enum RolePers {
  GET_USER = 'GET_USER',
  CREATE_USER = 'CREATE_USER',
  UPDATE_USER = 'UPDATE_USER',
  DELETE_USER = 'DELETE_USER',
  BANED_USER = 'BANED_USER',

  GET_ROLES = 'GET_ROLES',
  CREATE_ROLES = 'CREATE_ROLES',
  UPDATE_ROLES = 'UPDATE_ROLES',
  DELETE_ROLES = 'DELETE_ROLES',
  UPDATE_ROLE_PERMISSIONS = 'UPDATE_ROLE_PERMISSIONS',
}

/** Quyền đặc biệt: có quyền này là có tất cả. */
export const PERMISSION_ALL = 'all';

/** Nhóm permission dùng cho màn hình phân quyền ở frontend. */
export const PermissionGroup: Record<string, RolePers[]> = {
  USER: [
    RolePers.GET_USER,
    RolePers.CREATE_USER,
    RolePers.UPDATE_USER,
    RolePers.BANED_USER,
    RolePers.DELETE_USER,
  ],
  ROLES: [
    RolePers.GET_ROLES,
    RolePers.CREATE_ROLES,
    RolePers.UPDATE_ROLES,
    RolePers.DELETE_ROLES,
    RolePers.UPDATE_ROLE_PERMISSIONS,
  ],
};

/** Toàn bộ permission (phẳng). */
export const ALL_PERMISSIONS: string[] = Object.values(PermissionGroup).reduce(
  (acc: string[], pers) => acc.concat(pers),
  [],
);

/** Slug của các role mặc định. */
export const ROLE_TYPE = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  MEMBER: 'member',
};
