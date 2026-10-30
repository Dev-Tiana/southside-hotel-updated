export function validPassword(password: unknown): boolean;
export function hashPassword(password: string): Promise<string>;
export function verifyPassword(encoded: string, password: string): Promise<boolean>;
export const dummyHash: string;
