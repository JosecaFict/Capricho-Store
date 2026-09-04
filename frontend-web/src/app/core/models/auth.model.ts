export type UserStatus = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';

export interface RegisterRequest {
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  ci: string | null;
  password: string;
}

export interface LoginRequest {
  correo: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export interface UserResponse {
  id_usuario: number;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  ci: string | null;
  estado: UserStatus;
  created_at: string;
  roles: string[];
  permisos: string[];
}
