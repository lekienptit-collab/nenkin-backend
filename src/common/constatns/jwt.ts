export const JWT_LIFETIME = +process.env.JWT_LIFETIME || 3600;
export const JWT_RF_LIFETIME = +process.env.JWT_RF_LIFETIME || 2592000;
export const JWT_SECRET = process.env.JWT_SECRET || 'change-this-jwt-secret';
/** Prefix cache đánh dấu token đã logout */
export const JWT_LOG_OUT = 'LO';
