import Papa from "papaparse";
import type { Account, AccountType, Employee, EmploymentStatus } from "./types";

// Parsing is strict on purpose: a review built on a half-read file is worse
// than no review. Missing columns stop the import; bad rows are reported.

export const HR_COLUMNS = [
  "employee_id",
  "name",
  "email",
  "department",
  "title",
  "manager_id",
  "status",
  "hire_date",
  "termination_date",
] as const;

export const ACCOUNT_COLUMNS = [
  "account_id",
  "system",
  "username",
  "employee_id",
  "owner_id",
  "account_type",
  "enabled",
  "last_login",
  "mfa_enrolled",
  "entitlements",
] as const;

export interface ParseResult<T> {
  rows: T[];
  errors: string[];
}

type Raw = Record<string, string>;

function parse(text: string, required: readonly string[], label: string) {
  const out = Papa.parse<Raw>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
    transform: (v) => v.trim(),
  });
  const errors: string[] = out.errors.slice(0, 5).map((e) => `${label} row ${(e.row ?? 0) + 2}: ${e.message}`);
  const fields = out.meta.fields ?? [];
  const missing = required.filter((c) => !fields.includes(c));
  if (missing.length) errors.unshift(`${label}: missing column(s) ${missing.join(", ")}`);
  return { data: missing.length ? [] : out.data, errors };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const bool = (v: string) => ["true", "yes", "1", "y"].includes(v.toLowerCase());

export function parseEmployees(text: string): ParseResult<Employee> {
  const { data, errors } = parse(text, HR_COLUMNS, "HR file");
  const rows: Employee[] = [];
  const seen = new Set<string>();
  data.forEach((r, i) => {
    const line = i + 2;
    const status = r.status as EmploymentStatus;
    if (!r.employee_id) return void errors.push(`HR file row ${line}: empty employee_id`);
    if (seen.has(r.employee_id)) return void errors.push(`HR file row ${line}: duplicate employee_id ${r.employee_id}`);
    if (!["Active", "Terminated", "Leave"].includes(status))
      return void errors.push(`HR file row ${line}: status must be Active, Terminated or Leave`);
    if (!ISO.test(r.hire_date)) return void errors.push(`HR file row ${line}: hire_date must be yyyy-mm-dd`);
    if (status === "Terminated" && !ISO.test(r.termination_date))
      return void errors.push(`HR file row ${line}: terminated employee needs termination_date (yyyy-mm-dd)`);
    seen.add(r.employee_id);
    rows.push({
      employeeId: r.employee_id,
      name: r.name,
      email: r.email,
      department: r.department,
      title: r.title,
      managerId: r.manager_id,
      status,
      hireDate: r.hire_date,
      terminationDate: r.termination_date,
    });
  });
  return { rows, errors };
}

export function parseAccounts(text: string): ParseResult<Account> {
  const { data, errors } = parse(text, ACCOUNT_COLUMNS, "Accounts file");
  const rows: Account[] = [];
  data.forEach((r, i) => {
    const line = i + 2;
    const type = r.account_type as AccountType;
    if (!r.account_id || !r.system) return void errors.push(`Accounts file row ${line}: account_id and system are required`);
    if (!["human", "service", "shared"].includes(type))
      return void errors.push(`Accounts file row ${line}: account_type must be human, service or shared`);
    if (r.last_login && !ISO.test(r.last_login))
      return void errors.push(`Accounts file row ${line}: last_login must be yyyy-mm-dd or empty`);
    rows.push({
      accountId: r.account_id,
      system: r.system,
      username: r.username,
      employeeId: r.employee_id,
      ownerId: r.owner_id,
      accountType: type,
      enabled: bool(r.enabled),
      lastLogin: r.last_login,
      mfaEnrolled: bool(r.mfa_enrolled),
      entitlements: r.entitlements ? r.entitlements.split(";").map((e) => e.trim()).filter(Boolean) : [],
    });
  });
  return { rows, errors };
}

export function toCsv(rows: Record<string, string | number>[]): string {
  return Papa.unparse(rows);
}
