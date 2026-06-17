import type { UserRow } from "@/hooks/use-users";
import { z } from "zod";

export const PHONE_PREFIXES = ["+91", "+1", "+44", "+971"] as const;
export type PhonePrefix = (typeof PHONE_PREFIXES)[number];

export const TIME_ZONE_OPTIONS = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
] as const;

export const DEPARTMENT_OPTIONS = [
  "Sales",
  "Marketing",
  "Operations",
  "Finance",
  "Human Resources",
  "Technology",
] as const;

export const DESIGNATION_OPTIONS = [
  "Sales Executive",
  "Senior Sales Executive",
  "Team Lead",
  "Manager",
  "General Manager",
  "Director",
] as const;

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(50)
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Username may only contain letters, numbers, dots, hyphens, and underscores",
  );

const phonePrefixSchema = z.enum(PHONE_PREFIXES);

const sharedFields = {
  username: usernameSchema,
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  workEmail: z.string().trim().email("Work email is required"),
  workPhonePrefix: phonePrefixSchema,
  workPhoneNumber: z.string().trim().optional(),
  personalPhonePrefix: phonePrefixSchema,
  personalPhoneNumber: z.string().trim().optional(),
  homeLocation: z.string().trim().optional(),
  generalManagerId: z.string().uuid().nullable().optional(),
  reportingToId: z.string().uuid().nullable().optional(),
  department: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  timeZone: z.string().trim().min(1, "Time zone is required"),
  brokerNumber: z.string().trim().optional(),
  description: z.string().trim().optional(),
  selectedRoleName: z.string().trim().min(1, "Select a role"),
  isActive: z.boolean(),
};

export const createUserFormSchema = z
  .object({
    ...sharedFields,
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const editUserFormSchema = z
  .object({
    ...sharedFields,
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .refine((value) => !value.password || value.password.length >= 6, {
    message: "Password must be at least 6 characters",
    path: ["password"],
  })
  .refine((value) => !value.password || value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;
export type EditUserFormValues = z.infer<typeof editUserFormSchema>;
export type UserFormValues = CreateUserFormValues | EditUserFormValues;

export const defaultUserFormValues: CreateUserFormValues = {
  username: "",
  password: "",
  confirmPassword: "",
  firstName: "",
  lastName: "",
  workEmail: "",
  workPhonePrefix: "+91",
  workPhoneNumber: "",
  personalPhonePrefix: "+91",
  personalPhoneNumber: "",
  homeLocation: "",
  generalManagerId: null,
  reportingToId: null,
  department: "",
  designation: "",
  timeZone: "Asia/Kolkata",
  brokerNumber: "",
  description: "",
  selectedRoleName: "Basic",
  isActive: true,
};

export function parseStoredPhone(value: string | null | undefined) {
  if (!value?.trim()) {
    return { prefix: "+91" as PhonePrefix, number: "" };
  }

  const match = value.trim().match(/^(\+\d{1,4})\s*(.*)$/);
  if (match) {
    const prefix = PHONE_PREFIXES.includes(match[1] as PhonePrefix)
      ? (match[1] as PhonePrefix)
      : "+91";
    return { prefix, number: match[2] ?? "" };
  }

  return { prefix: "+91" as PhonePrefix, number: value.trim() };
}

export function combinePhone(prefix: PhonePrefix, number: string) {
  const digits = number.trim();
  if (!digits) return null;
  return `${prefix} ${digits}`;
}

/** Mirrors apps/api/src/lib/role-mapping.ts — API derives users.role from roleLabel on save. */
export function roleNameToSystemRole(name: string): "admin" | "manager" | "agent" {
  const normalized = name.trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "manager") return "manager";
  // Basic, Agent, and other labels map to the agent permission tier.
  return "agent";
}

function resolveDisplayName(values: Pick<UserFormValues, "firstName" | "lastName" | "username">) {
  const fromParts = [values.firstName, values.lastName].filter(Boolean).join(" ").trim();
  return fromParts || values.username.trim();
}

function sharedPayloadFields(values: UserFormValues) {
  return {
    username: values.username.trim(),
    name: resolveDisplayName(values),
    email: values.workEmail.trim().toLowerCase(),
    workEmail: values.workEmail.trim().toLowerCase(),
    firstName: values.firstName?.trim() || null,
    lastName: values.lastName?.trim() || null,
    workPhone: combinePhone(values.workPhonePrefix, values.workPhoneNumber ?? ""),
    personalPhone: combinePhone(values.personalPhonePrefix, values.personalPhoneNumber ?? ""),
    homeLocation: values.homeLocation?.trim() || null,
    generalManagerId: values.generalManagerId ?? null,
    reportingToId: values.reportingToId ?? null,
    department: values.department?.trim() || null,
    designation: values.designation?.trim() || null,
    timeZone: values.timeZone.trim(),
    brokerNumber: values.brokerNumber?.trim() || null,
    description: values.description?.trim() || null,
    roleLabel: values.selectedRoleName.trim(),
    phone: combinePhone(values.workPhonePrefix, values.workPhoneNumber ?? ""),
  };
}

export function createUserFormToPayload(values: CreateUserFormValues) {
  return {
    ...sharedPayloadFields(values),
    password: values.password,
    role: roleNameToSystemRole(values.selectedRoleName),
  };
}

export function editUserFormToPayload(values: EditUserFormValues) {
  const payload = {
    ...sharedPayloadFields(values),
    isActive: values.isActive,
  } as ReturnType<typeof sharedPayloadFields> & { isActive: boolean; password?: string };

  if (values.password?.trim()) {
    payload.password = values.password;
  }

  return payload;
}

export function userToFormValues(user: UserRow): EditUserFormValues {
  const workPhone = parseStoredPhone(user.workPhone ?? user.phone);
  const personalPhone = parseStoredPhone(user.personalPhone);

  return {
    username: user.username,
    password: "",
    confirmPassword: "",
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    workEmail: user.workEmail ?? user.email,
    workPhonePrefix: workPhone.prefix,
    workPhoneNumber: workPhone.number,
    personalPhonePrefix: personalPhone.prefix,
    personalPhoneNumber: personalPhone.number,
    homeLocation: user.homeLocation ?? "",
    generalManagerId: user.generalManagerId ?? null,
    reportingToId: user.reportingToId ?? null,
    department: user.department ?? "",
    designation: user.designation ?? "",
    timeZone: user.timeZone ?? "Asia/Kolkata",
    brokerNumber: user.brokerNumber ?? "",
    description: user.description ?? "",
    selectedRoleName:
      user.roleLabel?.trim() ||
      (user.role === "admin" ? "Admin" : user.role === "manager" ? "Manager" : "Basic"),
    isActive: user.isActive,
  };
}

export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  "*": "Full access to all modules and settings.",
  "master_data:search": "Search master data and reference catalogs.",
  "dashboard:view": "View personal dashboard metrics.",
  "dashboard:view_team": "View team dashboard and pipeline summaries.",
  "users:view": "View the user directory.",
  "users:search": "Search and filter users.",
  "users:create": "Create new user accounts.",
  "users:update": "Edit user profiles and access.",
  "users:delete": "Deactivate or remove users.",
  "users:view_for_filter": "Include users in assignment filters.",
  "user_profile:view": "View user profile details.",
  "user_profile:update": "Update own or assigned user profiles.",
  "user_roles:view": "View role groups and permissions.",
  "user_roles:update": "Manage role groups and permissions.",
  "leads:view": "View assigned leads.",
  "leads:search": "Search leads in scope.",
  "leads:create": "Create new leads.",
  "leads:update": "Update lead records.",
  "leads:delete": "Delete leads.",
  "leads:assign": "Assign leads to team members.",
  "leads:view_all": "View all organization leads.",
  "leads:view_lead_source": "View lead source information.",
  "leads:update_basic_info": "Edit lead contact and property details.",
  "leads:update_lead_status": "Change lead pipeline status.",
  "leads:update_notes": "Add and edit lead notes.",
  "reports:view": "View standard reports.",
  "reports:view_all": "View organization-wide reports.",
  "reports:view_reportees": "View reports for direct reportees.",
  "reports:export": "Export report data.",
  "org_profile:view": "View organization profile.",
  "org_profile:update": "Update organization profile.",
  "projects:view": "View project catalog.",
  "projects:create": "Create projects.",
  "projects:update": "Edit project details.",
  "projects:delete": "Delete projects.",
};

export const FALLBACK_USER_ROLES = [
  {
    id: "basic",
    name: "Basic",
    permissions: [
      "master_data:search",
      "dashboard:view",
      "dashboard:view_team",
      "users:view_for_filter",
      "user_profile:view",
      "user_profile:update",
      "leads:view",
      "leads:search",
      "leads:create",
      "leads:update",
      "leads:assign",
      "leads:view_lead_source",
      "leads:update_basic_info",
      "leads:update_lead_status",
      "leads:update_notes",
      "reports:view",
      "reports:view_reportees",
    ],
  },
  {
    id: "manager",
    name: "Manager",
    permissions: [
      "master_data:search",
      "dashboard:view",
      "dashboard:view_team",
      "users:view",
      "users:search",
      "users:create",
      "users:update",
      "users:delete",
      "users:view_for_filter",
      "user_profile:view",
      "user_profile:update",
      "user_roles:view",
      "user_roles:update",
      "leads:view",
      "leads:search",
      "leads:create",
      "leads:update",
      "leads:delete",
      "leads:assign",
      "leads:view_all",
      "reports:view",
      "reports:view_all",
      "reports:export",
      "org_profile:view",
      "org_profile:update",
    ],
  },
  {
    id: "admin",
    name: "Admin",
    permissions: ["*"],
  },
];

export function formatPermissionLines(permissions: string[]) {
  if (permissions.includes("*")) {
    return [PERMISSION_DESCRIPTIONS["*"]];
  }

  return permissions.map((permission) => PERMISSION_DESCRIPTIONS[permission] ?? permission);
}
