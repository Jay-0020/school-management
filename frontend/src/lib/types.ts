export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "ACCOUNTANT"
  | "TEACHER"
  | "STUDENT"
  | "PARENT";

export interface User {
  id: string;
  email: string;
  phone?: string | null;
  role: Role;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
}

export interface SchoolSettings {
  name: string;
  shortName?: string | null;
  primaryColor: string;
  logoUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  currency: string;
  timezone: string;
  academicYear?: string | null;
}
