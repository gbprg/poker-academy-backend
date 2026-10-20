export type AuthenticatedUser = {
  id: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE';
};

export type AccessTokenPayload = {
  sub: string;
  jti: string;
};
