export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}
