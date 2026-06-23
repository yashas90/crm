"use client";

import { PhoneField } from "@/components/users/phone-field";
import { UserActiveSwitch } from "@/components/users/user-active-switch";
import { UserRolesPanel } from "@/components/users/user-roles-panel";
import { useSession } from "@/hooks/use-session";
import { useUserRoles } from "@/hooks/use-user-roles";
import { type UserRow, useCreateUser, useUpdateUser, useUsers } from "@/hooks/use-users";
import { getErrorMessage } from "@/lib/errors";
import { formatUserFullName } from "@/lib/user-display";
import {
  type CreateUserFormValues,
  DEPARTMENT_OPTIONS,
  DESIGNATION_OPTIONS,
  type EditUserFormValues,
  TIME_ZONE_OPTIONS,
  createUserFormSchema,
  createUserFormToPayload,
  defaultUserFormValues,
  editUserFormSchema,
  editUserFormToPayload,
  userToFormValues,
} from "@/lib/user-form-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const textareaClass =
  "flex min-h-[6rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type UserFormProps =
  | {
      mode: "create";
      user?: never;
      readOnly?: boolean;
    }
  | {
      mode: "edit";
      user: UserRow;
      readOnly?: boolean;
    };

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-2 border-black bg-card p-5 shadow-[2px_2px_0_0_#000]">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

function UserSelectField({
  label,
  value,
  onChange,
  users,
  placeholder,
  readOnly,
  excludeUserId,
  error,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  users: UserRow[];
  placeholder: string;
  readOnly?: boolean;
  excludeUserId?: string;
  error?: string;
}) {
  const options = users.filter((user) => user.id !== excludeUserId);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select
        className={selectClass}
        value={value ?? ""}
        disabled={readOnly}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">{placeholder}</option>
        {options.map((user) => (
          <option key={user.id} value={user.id}>
            {formatUserFullName(user)} ({user.username})
          </option>
        ))}
      </select>
      <FieldError message={error} />
    </div>
  );
}

export function UserForm({ mode, user, readOnly = false }: UserFormProps) {
  const router = useRouter();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const { isAdmin: sessionIsAdmin } = useSession();
  const usersQuery = useUsers();
  const rolesQuery = useUserRoles();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isCreate = mode === "create";
  const schema = isCreate ? createUserFormSchema : editUserFormSchema;

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues | EditUserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultUserFormValues,
  });

  const users = usersQuery.data ?? [];
  const roles = rolesQuery.data ?? [];

  const orgAdmin = useMemo(
    () =>
      users.find((item) => item.role === "admin" && item.isActive) ??
      users.find((item) => item.role === "admin"),
    [users],
  );

  useEffect(() => {
    if (user) {
      reset(userToFormValues(user));
    }
  }, [user, reset]);

  useEffect(() => {
    if (!sessionIsAdmin && orgAdmin && mode === "create") {
      setValue("generalManagerId", orgAdmin.id, { shouldDirty: false });
    }
  }, [mode, orgAdmin, sessionIsAdmin, setValue]);

  const isSaving = isSubmitting || createUser.isPending || updateUser.isPending;

  function onSubmit(values: CreateUserFormValues | EditUserFormValues) {
    setSubmitError(null);

    if (isCreate) {
      createUser.mutate(createUserFormToPayload(values as CreateUserFormValues), {
        onSuccess: (created) => router.push(`/users/${created.id}`),
        onError: (error) => setSubmitError(getErrorMessage(error)),
      });
      return;
    }

    updateUser.mutate(
      {
        userId: user!.id,
        payload: editUserFormToPayload(values as EditUserFormValues),
      },
      {
        onSuccess: () => router.push("/users"),
        onError: (error) => setSubmitError(getErrorMessage(error)),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {mode === "edit" ? (
        <div className="flex items-center justify-end">
          <Controller
            name="isActive"
            control={control}
            render={({ field }) => (
              <UserActiveSwitch
                checked={field.value}
                disabled={readOnly}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <FormSection title="Basic Information">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">
                Username <span className="text-destructive">*</span>
              </Label>
              <Input id="username" disabled={readOnly} {...register("username")} />
              <FieldError message={errors.username?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password {isCreate ? <span className="text-destructive">*</span> : null}
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                disabled={readOnly}
                placeholder={isCreate ? undefined : "Leave blank to keep current password"}
                {...register("password")}
              />
              <FieldError message={errors.password?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirm Password {isCreate ? <span className="text-destructive">*</span> : null}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                disabled={readOnly}
                {...register("confirmPassword")}
              />
              <FieldError message={errors.confirmPassword?.message} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" disabled={readOnly} {...register("firstName")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" disabled={readOnly} {...register("lastName")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workEmail">
                Work Email <span className="text-destructive">*</span>
              </Label>
              <Input id="workEmail" type="email" disabled={readOnly} {...register("workEmail")} />
              <FieldError message={errors.workEmail?.message} />
            </div>

            <Controller
              name="workPhonePrefix"
              control={control}
              render={({ field: prefixField }) => (
                <Controller
                  name="workPhoneNumber"
                  control={control}
                  render={({ field: numberField }) => (
                    <PhoneField
                      label="Work Phone"
                      prefix={prefixField.value}
                      number={numberField.value ?? ""}
                      onPrefixChange={prefixField.onChange}
                      onNumberChange={numberField.onChange}
                      readOnly={readOnly}
                    />
                  )}
                />
              )}
            />

            <Controller
              name="personalPhonePrefix"
              control={control}
              render={({ field: prefixField }) => (
                <Controller
                  name="personalPhoneNumber"
                  control={control}
                  render={({ field: numberField }) => (
                    <PhoneField
                      label="Personal Phone"
                      prefix={prefixField.value}
                      number={numberField.value ?? ""}
                      onPrefixChange={prefixField.onChange}
                      onNumberChange={numberField.onChange}
                      readOnly={readOnly}
                    />
                  )}
                />
              )}
            />

            <div className="space-y-2">
              <Label htmlFor="homeLocation">Home Location</Label>
              <Input id="homeLocation" disabled={readOnly} {...register("homeLocation")} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Office Information">
          <div className="space-y-4">
            {sessionIsAdmin ? (
              <Controller
                name="generalManagerId"
                control={control}
                render={({ field }) => (
                  <UserSelectField
                    label="General Manager"
                    value={field.value}
                    onChange={field.onChange}
                    users={users}
                    placeholder="Select general manager"
                    readOnly={readOnly}
                    excludeUserId={user?.id}
                  />
                )}
              />
            ) : (
              <div className="space-y-2">
                <Label>General Manager</Label>
                <Input
                  readOnly
                  disabled
                  value={orgAdmin ? `${formatUserFullName(orgAdmin)} (${orgAdmin.username})` : "—"}
                />
              </div>
            )}

            <Controller
              name="reportingToId"
              control={control}
              render={({ field }) => (
                <UserSelectField
                  label="Reporting To"
                  value={field.value}
                  onChange={field.onChange}
                  users={users}
                  placeholder="Select manager"
                  readOnly={readOnly}
                  excludeUserId={user?.id}
                />
              )}
            />

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                list="department-options"
                disabled={readOnly}
                {...register("department")}
              />
              <datalist id="department-options">
                {DEPARTMENT_OPTIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input
                id="designation"
                list="designation-options"
                disabled={readOnly}
                {...register("designation")}
              />
              <datalist id="designation-options">
                {DESIGNATION_OPTIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeZone">Time Zone</Label>
              <select
                id="timeZone"
                className={selectClass}
                disabled={readOnly}
                {...register("timeZone")}
              >
                {TIME_ZONE_OPTIONS.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
              <FieldError message={errors.timeZone?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brokerNumber">Broker Number</Label>
              <Input id="brokerNumber" disabled={readOnly} {...register("brokerNumber")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                className={textareaClass}
                disabled={readOnly}
                {...register("description")}
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Roles & Permissions">
          <Controller
            name="selectedRoleName"
            control={control}
            render={({ field }) => (
              <UserRolesPanel
                roles={roles}
                selectedRoleName={field.value}
                onSelectRole={field.onChange}
                readOnly={readOnly}
                isAdmin={sessionIsAdmin}
                error={errors.selectedRoleName?.message}
              />
            )}
          />
        </FormSection>
      </div>

      {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/users")}>
          Cancel
        </Button>
        {!readOnly ? (
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
