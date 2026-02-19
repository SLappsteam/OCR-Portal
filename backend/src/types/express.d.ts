export interface AccessTokenPayload {
  userId: number;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
      accessibleStoreIds?: number[] | null;
      requestId?: string;
    }
  }
}
