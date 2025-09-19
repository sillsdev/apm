export interface IdToken {
  name: string;
  email: string;
  picture: string;
  iss: string; // issuer
  aud: string; // audience
  iat: number; // issued at
  exp: number; // expiration
  sub: string; // subject
  email_verified: boolean;
}
