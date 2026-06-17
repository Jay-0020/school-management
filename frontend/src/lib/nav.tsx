import type { ComponentType, SVGProps } from "react";
import {
  IconAttendance,
  IconBell,
  IconBook,
  IconCalendar,
  IconHome,
  IconReceipt,
  IconRupee,
  IconSettings,
  IconStudents,
  IconTeacher,
  IconUser,
  IconUsers,
  IconWallet,
} from "../components/icons";
import type { Role } from "./types";

export interface NavItem {
  label: string;
  path: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  roles: Role[];
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL: Role[] = ["SUPER_ADMIN", "ADMIN", "DEAN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT"];

export const NAV: NavGroup[] = [
  {
    label: "",
    items: [
      { label: "Dashboard", path: "/", icon: IconHome, roles: ALL },
      { label: "My Children", path: "/children", icon: IconStudents, roles: ["PARENT"] },
      { label: "My Profile", path: "/profile", icon: IconUser, roles: ALL },
      { label: "Feedback", path: "/feedback", icon: IconTeacher, roles: ["STUDENT", "PARENT"] },
      {
        label: "Complaints",
        path: "/complaints",
        icon: IconBell,
        roles: ["STUDENT", "TEACHER", "PARENT", "DEAN", "SUPER_ADMIN"],
      },
      { label: "Leave", path: "/leave", icon: IconCalendar, roles: ALL },
    ],
  },
  {
    label: "People",
    items: [
      {
        label: "Directory",
        path: "/people",
        icon: IconUsers,
        roles: ["SUPER_ADMIN", "ADMIN", "DEAN", "TEACHER"],
      },
      {
        label: "Students",
        path: "/students",
        icon: IconStudents,
        roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "ACCOUNTANT"],
      },
      {
        label: "Teachers & Staff",
        path: "/teachers",
        icon: IconTeacher,
        roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"],
      },
      {
        label: "Staff Attendance",
        path: "/staff-attendance",
        icon: IconAttendance,
        roles: ["SUPER_ADMIN", "ADMIN", "DEAN"],
      },
      {
        label: "Teacher Performance",
        path: "/teacher-performance",
        icon: IconBook,
        roles: ["SUPER_ADMIN", "ADMIN", "DEAN"],
      },
      {
        label: "User Accounts",
        path: "/users",
        icon: IconUsers,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
    ],
  },
  {
    label: "Academics",
    items: [
      {
        label: "Attendance",
        path: "/attendance",
        icon: IconAttendance,
        roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"],
      },
      {
        label: "Homework",
        path: "/schoolwork",
        icon: IconBook,
        roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"],
      },
      {
        label: "Exams",
        path: "/exams",
        icon: IconBook,
        roles: ["SUPER_ADMIN", "ADMIN", "DEAN", "TEACHER", "STUDENT"],
      },
      {
        label: "Study Notes",
        path: "/notes",
        icon: IconBook,
        roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"],
      },
      { label: "Notices", path: "/notices", icon: IconBell, roles: ALL },
      {
        label: "Teaching Assignments",
        path: "/assignments",
        icon: IconTeacher,
        roles: ["SUPER_ADMIN", "ADMIN", "DEAN"],
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Fees",
        path: "/fees",
        icon: IconRupee,
        roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"],
      },
      {
        label: "Payroll",
        path: "/payroll",
        icon: IconWallet,
        roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "TEACHER"],
      },
      {
        label: "Expenses",
        path: "/expenses",
        icon: IconReceipt,
        roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "TEACHER", "DEAN"],
      },
      {
        label: "Final Settlements",
        path: "/settlements",
        icon: IconWallet,
        roles: ["SUPER_ADMIN", "ADMIN", "DEAN", "ACCOUNTANT"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "School Setup",
        path: "/setup",
        icon: IconSettings,
        roles: ["SUPER_ADMIN", "ADMIN", "DEAN"],
      },
      {
        label: "Activity Log",
        path: "/audit",
        icon: IconReceipt,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
    ],
  },
];

/** Groups (and items) filtered to a role; empty groups dropped. */
export function navForRole(role: Role): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}
