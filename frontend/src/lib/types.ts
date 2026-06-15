export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "DEAN"
  | "ACCOUNTANT"
  | "TEACHER"
  | "STUDENT"
  | "PARENT";

export interface AppNotification {
  id: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export type LeaveCategory = "CASUAL" | "SICK" | "EARNED" | "UNPAID";

export interface LeaveBalance {
  category: Exclude<LeaveCategory, "UNPAID">;
  quota: number;
  used: number;
  remaining: number;
}

export type LeaveKind = "ADVANCE" | "JUSTIFICATION";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveRequest {
  id: string;
  kind: LeaveKind;
  category: LeaveCategory;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  applicant?: {
    id: string;
    email: string;
    role: Role;
    student?: { id: string; firstName: string; lastName: string } | null;
    teacher?: { id: string; firstName: string; lastName: string } | null;
  };
  approver?: { id: string; email: string } | null;
}

export interface AttendanceYear {
  year: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  percent: number | null;
}
export interface ProfileMe {
  type: "student" | "staff" | "none";
  id?: string;
  name?: string;
  admissionNo?: string;
  className?: string | null;
  role?: Role;
  employeeNo?: string | null;
  message?: string;
  attendance?: {
    years: AttendanceYear[];
    monthly: { month: string; present: number; total: number; percent: number | null }[];
  };
  leave?: {
    approvedDays: number;
    pending: number;
    recent: { id: string; kind: LeaveKind; from: string; to: string; status: LeaveStatus; reason: string }[];
  };
}
export interface PeopleDirectory {
  students: {
    type: "student";
    id: string;
    name: string;
    admissionNo: string;
    className: string;
    attendancePercent: number | null;
  }[];
  staff: {
    type: "staff";
    id: string;
    name: string;
    employeeNo: string;
    staffType: string;
  }[];
}

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
  latitude?: number | null;
  longitude?: number | null;
  geofenceRadius?: number | null;
}

export type SaturdayRule = "NONE" | "ALL" | "ALTERNATE";
export interface SchoolCalendar {
  sessionStart: string | null;
  sessionEnd: string | null;
  saturdayRule: SaturdayRule;
  latitude: number | null;
  longitude: number | null;
  geofenceRadius: number;
  holidays: { date: string; note: string | null }[];
  workingDays: number;
  workingDaysToDate: number;
}
export interface StaffAttendanceMe {
  checkedInToday: boolean;
  checkInAt: string | null;
  attended: number;
  workingDays: number;
  percentage: number | null;
}
export interface StaffAttendanceRow {
  employeeNo: string;
  name: string;
  staffType: StaffType;
  attended: number;
  workingDays: number;
  percentage: number | null;
  present: boolean;
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

export interface Subject {
  id: string;
  name: string;
  code: string | null;
}

export interface ChildSummary {
  id: string;
  name: string;
  admissionNo: string;
  className: string | null;
}
export interface ChildOverview {
  student: ChildSummary;
  attendance: { year: string; present: number; absent: number; late: number; excused: number; total: number; percent: number | null }[];
  fees: {
    due: number;
    invoices: { id: string; title: string; total: number; amountPaid: number; status: InvoiceStatus; dueDate: string | null; balance: number }[];
  };
  homework: { id: string; title: string; subject: string | null; dueDate: string | null }[];
  exams: { id: string; name: string; term: string | null }[];
}

export type NoteStatus = "PENDING" | "APPROVED" | "REJECTED";
export interface SharedNote {
  id: string;
  title: string;
  description: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  status: NoteStatus;
  createdAt: string;
  subject?: { id: string; name: string } | null;
  section?: { id: string; name: string; class: { name: string } } | null;
  uploadedBy?: { id: string; email: string; role: Role } | null;
}

export type ExamStatus = "DRAFT" | "PUBLISHED";
export interface ExamPaper {
  id: string;
  subjectId: string;
  maxMarks: number;
  passMarks: number;
  subject: { id: string; name: string };
}
export interface Exam {
  id: string;
  name: string;
  classId: string;
  term: string | null;
  examDate: string | null;
  status: ExamStatus;
  class: { id: string; name: string };
  papers: ExamPaper[];
}
export interface MarkRosterEntry {
  studentId: string;
  admissionNo: string;
  name: string;
  marksObtained: number | null;
}
export interface ReportCard {
  exam: { id: string; name: string; term: string | null; status: ExamStatus };
  student: { id: string; name: string; admissionNo: string; className: string | null };
  subjects: {
    subject: string;
    maxMarks: number;
    passMarks: number;
    marksObtained: number | null;
    percent: number | null;
    grade: string | null;
    passed: boolean | null;
  }[];
  totalObtained: number;
  totalMax: number;
  overallPercent: number | null;
  overallGrade: string | null;
  result: "PASS" | "FAIL" | null;
}

export interface Homework {
  id: string;
  title: string;
  description: string;
  sectionId: string;
  subjectId: string | null;
  dueDate: string | null;
  createdAt: string;
  subject?: { id: string; name: string } | null;
  section?: { id: string; name: string; class: { name: string } } | null;
  assignedBy?: { id: string; email: string } | null;
}

export type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
export type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "UPI"
  | "CARD"
  | "CHEQUE"
  | "ONLINE"
  | "OTHER";

export interface FeeStructure {
  id: string;
  classId: string;
  name: string;
  amount: number;
}

export interface InvoiceItem {
  id: string;
  name: string;
  amount: number;
}

export interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paidAt: string;
}

export interface Invoice {
  id: string;
  studentId: string;
  title: string;
  total: number;
  amountPaid: number;
  status: InvoiceStatus;
  dueDate: string | null;
  createdAt: string;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNo: string;
    section?: { name: string; class: { name: string } } | null;
  };
}

export interface InvoiceDetail extends Invoice {
  items: InvoiceItem[];
  payments: Payment[];
}

export type ExpenseStatus = "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: string | null;
  status: ExpenseStatus;
  decisionNote: string | null;
  decidedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  submittedBy?: { id: string; email: string; role: Role } | null;
  decidedBy?: { id: string; email: string } | null;
}

export interface ExpenseSummaryRow {
  status: ExpenseStatus;
  count: number;
  total: number;
}

export interface SalaryStructure {
  id: string;
  teacherId: string;
  basic: number;
  hra: number;
  da: number;
  conveyance: number;
  specialAllowance: number;
  pfApplicable: boolean;
  esiApplicable: boolean;
  professionalTax: number;
  tdsMonthly: number;
}

export interface StaffWithStructure {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
  staffType: StaffType;
  salaryStructure: SalaryStructure | null;
}

export type PayslipStatus = "GENERATED" | "PAID";

export interface Payslip {
  id: string;
  teacherId: string;
  month: string;
  basic: number;
  hra: number;
  da: number;
  conveyance: number;
  specialAllowance: number;
  gross: number;
  pf: number;
  esi: number;
  professionalTax: number;
  tds: number;
  totalDeductions: number;
  net: number;
  status: PayslipStatus;
  paidAt: string | null;
  teacher?: { id: string; firstName: string; lastName: string; employeeNo: string };
}

export interface ManagedUser {
  id: string;
  email: string;
  phone?: string | null;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  casualQuota: number;
  sickQuota: number;
  earnedQuota: number;
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
