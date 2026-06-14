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

export interface SectionSummary {
  id: string;
  name: string;
  classTeacher?: { id: string; firstName: string; lastName: string } | null;
  _count: { students: number };
}

export interface ClassWithSections {
  id: string;
  name: string;
  order: number;
  sections: SectionSummary[];
}

export type EnrollmentStatus = "ACTIVE" | "INACTIVE" | "ALUMNI" | "TRANSFERRED";

export interface Student {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  sectionId?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  address?: string | null;
  status: EnrollmentStatus;
  section?: {
    id: string;
    name: string;
    class: { id: string; name: string };
  } | null;
}

export type StaffType = "TEACHING" | "NON_TEACHING";

export interface Teacher {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  staffType: StaffType;
  qualifications?: string | null;
  joiningDate?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface RosterEntry {
  studentId: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  status: AttendanceStatus | null;
  note: string | null;
}

export interface ManagedUser {
  id: string;
  email: string;
  phone?: string | null;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  teacher?: { id: string; firstName: string; lastName: string; employeeNo: string } | null;
  student?: { id: string; firstName: string; lastName: string; admissionNo: string } | null;
}

export type NoticeAudience = "ALL" | "STUDENTS" | "STAFF" | "SECTION";

export interface Notice {
  id: string;
  title: string;
  body: string;
  audience: NoticeAudience;
  sectionId: string | null;
  pinned: boolean;
  authorId: string | null;
  createdAt: string;
  author?: { id: string; email: string; role: Role } | null;
  section?: { id: string; name: string; class: { name: string } } | null;
}

export interface AttendanceSummaryRow {
  studentId: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  EXCUSED: number;
  marked: number;
  percent: number | null;
}
