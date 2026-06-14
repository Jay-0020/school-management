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
      { label: "My Profile", path: "/profile", icon: IconUser, roles: ALL },
      { label: "Leave", path: "/leave", icon: IconCalendar, roles: ALL },
    ],
  },
  {
    label: "People",
    items: [
      {
        label: "Overview",
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
        label: "Users",
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
        label: "Schoolwork",
        path: "/schoolwork",
        icon: IconBook,
        roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"],
      },
      { label: "Notices", path: "/notices", icon: IconBell, roles: ALL },
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
        roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "TEACHER"],
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
