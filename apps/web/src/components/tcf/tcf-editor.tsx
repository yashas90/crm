"use client";

import { useSession } from "@/hooks/use-session";
import { type TcfDetail, useTcfMutations } from "@/hooks/use-transaction-closures";
import { useUsers } from "@/hooks/use-users";
import { getErrorMessage } from "@/lib/errors";
import {
  INVOICE_STATUSES,
  TCF_CHANNELS,
  TCF_CURRENCIES,
  TCF_FLAGS,
  TCF_SEGMENTS,
  type TcfForm,
  asTcfForm,
  emptyTcfForm,
} from "@/lib/tcf-form";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 text-sm ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-slate-500">{label}</span>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details
      open
      className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800"
    >
      <summary className="cursor-pointer bg-sky-700 px-4 py-2 text-sm font-semibold text-white">
        {title}
      </summary>
      <div className="grid gap-3 p-4 md:grid-cols-2">{children}</div>
    </details>
  );
}

const selectClass = "h-10 rounded-md border bg-transparent px-3 text-sm";

export function TcfEditor({ record }: { record?: TcfDetail }) {
  const router = useRouter();
  const { isAdmin } = useSession();
  const users = useUsers(undefined, { enabled: true });
  const mutations = useTcfMutations();
  const [form, setForm] = useState<TcfForm>(() =>
    record ? asTcfForm(record.form) : emptyTcfForm(),
  );
  const [reason, setReason] = useState("");
  const [duplicateReason, setDuplicateReason] = useState("");

  useEffect(() => {
    if (record) setForm(asTcfForm(record.form));
  }, [record]);

  const locked = record?.status === "pending_approval" || record?.status === "approved";
  const shareTotal = form.shares.reduce((sum, share) => sum + Number(share.sharePercent || 0), 0);

  function patch(next: Partial<TcfForm>) {
    setForm((current) => ({ ...current, ...next }));
  }

  async function save() {
    try {
      if (!record) {
        const created = await mutations.create.mutateAsync(form);
        toast.success("Draft saved");
        router.push(`/tcf/${created.id}`);
        return;
      }
      await mutations.update.mutateAsync({ id: record.id, form });
      toast.success("TCF saved");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Transaction closure</p>
          <h1 className="text-xl font-semibold">{record?.tcfCode ?? "New TCF"}</h1>
          <p className="text-sm capitalize text-slate-500">
            {record?.status.replaceAll("_", " ") ?? "Draft"}
            {record?.rejectionReason ? ` — ${record.rejectionReason}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={locked} onClick={() => void save()}>
            Save
          </Button>
          {record && (record.status === "draft" || record.status === "rejected") ? (
            <Button
              type="button"
              onClick={() => {
                void mutations.update
                  .mutateAsync({ id: record.id, form })
                  .then(() => mutations.submit.mutateAsync(record.id))
                  .then(() => toast.success("Submitted for admin approval"))
                  .catch((error: unknown) => toast.error(getErrorMessage(error)));
              }}
            >
              Save & submit
            </Button>
          ) : null}
        </div>
      </div>

      <section className="grid gap-3 rounded-lg border p-4 md:grid-cols-4">
        <Field label="Segment *">
          <select
            className={selectClass}
            disabled={locked}
            value={form.segment}
            onChange={(event) => patch({ segment: event.target.value })}
          >
            {TCF_SEGMENTS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Channel *">
          <select
            className={selectClass}
            disabled={locked}
            value={form.channel}
            onChange={(event) => patch({ channel: event.target.value })}
          >
            {TCF_CHANNELS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Currency *">
          <select
            className={selectClass}
            disabled={locked}
            value={form.currency}
            onChange={(event) => patch({ currency: event.target.value })}
          >
            {TCF_CURRENCIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Cool off end date *">
          <Input
            type="date"
            disabled={locked}
            value={form.coolOffEndDate}
            onChange={(event) => patch({ coolOffEndDate: event.target.value })}
          />
        </Field>
        <Field label="Product name *">
          <Input
            disabled={locked}
            value={form.productName}
            onChange={(event) => patch({ productName: event.target.value })}
          />
        </Field>
        <Field label="Deal closure date *">
          <Input
            type="date"
            disabled={locked}
            value={form.dealClosureDate}
            onChange={(event) => patch({ dealClosureDate: event.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={locked}
            checked={form.clientAccess}
            onChange={(event) => patch({ clientAccess: event.target.checked })}
          />
          Client access
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={locked}
            checked={form.initialPaymentVerified}
            onChange={(event) => patch({ initialPaymentVerified: event.target.checked })}
          />
          Initial payment verified (CPS only)
        </label>
      </section>

      {record ? (
        <p className="text-sm text-slate-600">{record.incentiveNote}</p>
      ) : (
        <p className="text-sm text-slate-600">
          Save the draft first. Incentive stays at zero until an admin approves this TCF and the
          invoice is collected.
        </p>
      )}

      <Section title="Property details">
        {(
          [
            ["property", "Property *"],
            ["projectAreaNumber", "Project area number"],
            ["sizeSqm", "Size (SQM) *"],
            ["actualSize", "Actual size"],
            ["towerUnit", "Tower / unit *"],
            ["paymentPlan", "Payment plan"],
            ["parkings", "Parkings"],
            ["floorNo", "Floor number *"],
            ["bspPerSft", "BSP / SFT"],
            ["espPerSft", "ESP / SFT"],
            ["purpose", "Purpose of purchase *"],
            ["grossValue", "Gross monetary value"],
            ["totalConsideration", "Total consideration"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <Input
              disabled={locked}
              value={form.property[key]}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  property: { ...current.property, [key]: event.target.value },
                }))
              }
            />
          </Field>
        ))}
        <div className="md:col-span-2 space-y-2">
          <p className="text-sm font-medium">Additional charges</p>
          {form.charges.map((charge, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-5">
              <Input
                placeholder="Type"
                disabled={locked}
                value={charge.type}
                onChange={(event) =>
                  setForm((current) => {
                    const charges = [...current.charges];
                    charges[index] = { ...charge, type: event.target.value };
                    return { ...current, charges };
                  })
                }
              />
              <Input
                placeholder="Amount"
                disabled={locked}
                value={charge.amount}
                onChange={(event) =>
                  setForm((current) => {
                    const charges = [...current.charges];
                    charges[index] = { ...charge, amount: event.target.value };
                    return { ...current, charges };
                  })
                }
              />
              <Input
                placeholder="Unit"
                disabled={locked}
                value={charge.unit}
                onChange={(event) =>
                  setForm((current) => {
                    const charges = [...current.charges];
                    charges[index] = { ...charge, unit: event.target.value };
                    return { ...current, charges };
                  })
                }
              />
              <Input
                placeholder="Total"
                disabled={locked}
                value={charge.total}
                onChange={(event) =>
                  setForm((current) => {
                    const charges = [...current.charges];
                    charges[index] = { ...charge, total: event.target.value };
                    return { ...current, charges };
                  })
                }
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={charge.included}
                  onChange={(event) =>
                    setForm((current) => {
                      const charges = [...current.charges];
                      charges[index] = { ...charge, included: event.target.checked };
                      return { ...current, charges };
                    })
                  }
                />
                Included
              </label>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={locked}
            onClick={() =>
              patch({
                charges: [
                  ...form.charges,
                  { type: "", amount: "", unit: "", included: false, total: "" },
                ],
              })
            }
          >
            Add charge
          </Button>
        </div>
      </Section>

      <Section title="Client and lead details">
        <Field label="CRM lead ID">
          <Input
            disabled={locked}
            value={form.client.crmLeadId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client: { ...current.client, crmLeadId: event.target.value },
              }))
            }
          />
        </Field>
        <Field label="Client code">
          <Input
            disabled={locked}
            value={form.client.code}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client: { ...current.client, code: event.target.value },
              }))
            }
          />
        </Field>
        <Field label="Primary applicant *">
          <Input
            disabled={locked}
            value={form.client.primaryApplicant}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client: { ...current.client, primaryApplicant: event.target.value },
              }))
            }
          />
        </Field>
        <Field label="Client type">
          <Input disabled value={form.client.clientType} />
        </Field>
        <Field label="Mobile *">
          <Input
            disabled={locked}
            value={form.client.mobile}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client: { ...current.client, mobile: event.target.value },
              }))
            }
          />
        </Field>
        <Field label="Email *">
          <Input
            disabled={locked}
            value={form.client.email}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client: { ...current.client, email: event.target.value },
              }))
            }
          />
        </Field>
        <Field label="PAN">
          <Input
            disabled={locked}
            value={form.client.pan}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client: { ...current.client, pan: event.target.value },
              }))
            }
          />
        </Field>
        <Field label="Date of birth">
          <Input
            type="date"
            disabled={locked}
            value={form.client.dateOfBirth}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client: { ...current.client, dateOfBirth: event.target.value },
              }))
            }
          />
        </Field>
        <Field label="Alternate email">
          <Input
            disabled={locked}
            value={form.client.alternateEmail}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client: { ...current.client, alternateEmail: event.target.value },
              }))
            }
          />
        </Field>
        <Field label="Alternate mobile">
          <Input
            disabled={locked}
            value={form.client.alternateMobile}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client: { ...current.client, alternateMobile: event.target.value },
              }))
            }
          />
        </Field>
        <Field label="Lead source">
          <Input
            disabled={locked}
            value={form.client.leadSource}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client: { ...current.client, leadSource: event.target.value },
              }))
            }
          />
        </Field>
        <Field label="Google review link">
          <Input
            disabled={locked}
            value={form.client.googleReviewLink}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client: { ...current.client, googleReviewLink: event.target.value },
              }))
            }
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={locked}
            checked={form.client.homeLoanRequired}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client: { ...current.client, homeLoanRequired: event.target.checked },
              }))
            }
          />
          Home loan required
        </label>
        <Field label="Permanent address *" wide>
          <Input
            disabled={locked}
            value={form.client.permanent.address}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client: {
                  ...current.client,
                  permanent: { ...current.client.permanent, address: event.target.value },
                },
              }))
            }
          />
        </Field>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            disabled={locked}
            checked={form.client.sameAsPermanent}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client: {
                  ...current.client,
                  sameAsPermanent: event.target.checked,
                  correspondence: event.target.checked
                    ? current.client.permanent
                    : current.client.correspondence,
                },
              }))
            }
          />
          Correspondence address same as permanent
        </label>
        <Field label="Correspondence address" wide>
          <Input
            disabled={locked || form.client.sameAsPermanent}
            value={form.client.correspondence.address}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client: {
                  ...current.client,
                  correspondence: { ...current.client.correspondence, address: event.target.value },
                },
              }))
            }
          />
        </Field>
        <div className="md:col-span-2 space-y-2">
          <p className="text-sm font-medium">Co-applicants</p>
          {form.coApplicants.map((person, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-3">
              <Input
                placeholder="Name"
                disabled={locked}
                value={person.name}
                onChange={(event) =>
                  setForm((current) => {
                    const coApplicants = [...current.coApplicants];
                    coApplicants[index] = { ...person, name: event.target.value };
                    return { ...current, coApplicants };
                  })
                }
              />
              <Input
                placeholder="Mobile"
                disabled={locked}
                value={person.mobile}
                onChange={(event) =>
                  setForm((current) => {
                    const coApplicants = [...current.coApplicants];
                    coApplicants[index] = { ...person, mobile: event.target.value };
                    return { ...current, coApplicants };
                  })
                }
              />
              <Input
                placeholder="Email"
                disabled={locked}
                value={person.email}
                onChange={(event) =>
                  setForm((current) => {
                    const coApplicants = [...current.coApplicants];
                    coApplicants[index] = { ...person, email: event.target.value };
                    return { ...current, coApplicants };
                  })
                }
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={locked}
            onClick={() =>
              patch({ coApplicants: [...form.coApplicants, { name: "", mobile: "", email: "" }] })
            }
          >
            Add co-applicant
          </Button>
        </div>
      </Section>

      <Section title="Payment and commission">
        {(
          [
            ["bookingAmount", "Booking amount *"],
            ["chequeDetails", "Cheque / RTGS details *"],
            ["bankName", "Bank name *"],
            ["bankingDate", "Banking date"],
            ["commissionSlabNotes", "Commission notes"],
            ["baseCommission", "Base commission"],
            ["hstNotes", "HST / tax notes"],
            ["taxAmount", "Tax amount"],
            ["sspNotes", "SSP notes"],
            ["sspAdjustment", "SSP adjustment"],
            ["loyaltyNotes", "Loyalty notes"],
            ["loyaltyDiscount", "Loyalty discount"],
            ["miscNotes", "Misc notes"],
            ["miscAdjustment", "Misc adjustment"],
            ["specialRemarks", "Special remarks"],
            ["netRevenue", "Net revenue *"],
            ["taxPercent", "Tax %"],
            ["managementShare", "Management share"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <Input
              type={key === "bankingDate" ? "date" : "text"}
              disabled={locked}
              value={form.payment[key]}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  payment: { ...current.payment, [key]: event.target.value },
                }))
              }
            />
          </Field>
        ))}
        {(
          [
            ["chequeBanked", "Cheque banked"],
            ["discountNote", "Discount note"],
            ["developerCollected", "Developer incentives collected"],
            ["developerDisbursed", "Developer incentives disbursed"],
            ["convertible", "Convertible deal"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={locked}
              checked={form.payment[key]}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  payment: { ...current.payment, [key]: event.target.checked },
                }))
              }
            />
            {label}
          </label>
        ))}
        <Field label="Invoice status">
          <select
            className={selectClass}
            value={form.payment.invoiceStatus}
            disabled={!record || (record.status !== "approved" && !isAdmin)}
            onChange={(event) => {
              const invoiceStatus = event.target.value as TcfForm["payment"]["invoiceStatus"];
              if (!record) return;
              mutations.invoice.mutate(
                { id: record.id, invoiceStatus },
                {
                  onSuccess: () => toast.success("Invoice status updated"),
                  onError: (error) => toast.error(getErrorMessage(error)),
                },
              );
            }}
          >
            {INVOICE_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="TCF share">
        <p className="text-sm text-amber-700 md:col-span-2">
          Share is not stored until you click Save. The total cannot go above 100. A 50% share
          counts as half a unit for appraisal and half the net revenue for incentive.
        </p>
        {form.shares.map((share, index) => (
          <div key={index} className="grid gap-2 md:col-span-2 md:grid-cols-3">
            <select
              className={selectClass}
              disabled={locked}
              value={share.userId ?? ""}
              onChange={(event) => {
                const user = (users.data ?? []).find((item) => item.id === event.target.value);
                setForm((current) => {
                  const shares = [...current.shares];
                  shares[index] = {
                    ...share,
                    userId: user?.id ?? null,
                    employeeName: user?.name ?? share.employeeName,
                  };
                  return { ...current, shares };
                });
              }}
            >
              <option value="">Employee</option>
              {(users.data ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <Input
              placeholder="Employee name"
              disabled={locked}
              value={share.employeeName}
              onChange={(event) =>
                setForm((current) => {
                  const shares = [...current.shares];
                  shares[index] = { ...share, employeeName: event.target.value };
                  return { ...current, shares };
                })
              }
            />
            <Input
              placeholder="Share %"
              disabled={locked}
              value={share.sharePercent}
              onChange={(event) =>
                setForm((current) => {
                  const shares = [...current.shares];
                  shares[index] = { ...share, sharePercent: event.target.value };
                  return { ...current, shares };
                })
              }
            />
          </div>
        ))}
        <div className="md:col-span-2 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={locked}
            onClick={() =>
              patch({
                shares: [...form.shares, { userId: null, employeeName: "", sharePercent: "" }],
              })
            }
          >
            Add share
          </Button>
          <span className="text-sm">Total {shareTotal.toFixed(2)}%</span>
        </div>
      </Section>

      <Section title="Documents">
        <p className="text-sm text-slate-500 md:col-span-2">
          Record the loan document, payment-plan proof, and welcome-call document on this TCF.
          Choose a file to store its name with the closure.
        </p>
        {form.documents.map((document, index) => (
          <div key={index} className="grid gap-2 md:col-span-2 md:grid-cols-3">
            <select
              className={selectClass}
              disabled={locked}
              value={document.category}
              onChange={(event) =>
                setForm((current) => {
                  const documents = [...current.documents];
                  documents[index] = { ...document, category: event.target.value };
                  return { ...current, documents };
                })
              }
            >
              <option value="booking">Booking document</option>
              <option value="loan">Loan document</option>
              <option value="payment_plan">Payment plan proof</option>
              <option value="welcome">Onboarding welcome call</option>
            </select>
            <Input
              placeholder="Document type"
              disabled={locked}
              value={document.documentType}
              onChange={(event) =>
                setForm((current) => {
                  const documents = [...current.documents];
                  documents[index] = { ...document, documentType: event.target.value };
                  return { ...current, documents };
                })
              }
            />
            <Input
              type="file"
              disabled={locked}
              onChange={(event) => {
                const fileName = event.target.files?.[0]?.name ?? document.fileName;
                setForm((current) => {
                  const documents = [...current.documents];
                  documents[index] = { ...document, fileName };
                  return { ...current, documents };
                });
              }}
            />
            {document.fileName ? (
              <p className="text-xs text-slate-500 md:col-span-3">{document.fileName}</p>
            ) : null}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={locked}
          onClick={() =>
            patch({
              documents: [
                ...form.documents,
                { category: "booking", documentType: "", fileName: "" },
              ],
            })
          }
        >
          Add document
        </Button>
      </Section>

      <Section title="TCF flags">
        <div className="grid gap-2 md:col-span-2 md:grid-cols-2">
          {TCF_FLAGS.map((flag) => (
            <label key={flag} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={locked}
                checked={Boolean(form.flags[flag])}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    flags: { ...current.flags, [flag]: event.target.checked },
                  }))
                }
              />
              {flag}
            </label>
          ))}
        </div>
      </Section>

      {record ? (
        <Section title="History">
          <ul className="space-y-1 text-sm md:col-span-2">
            {record.events.map((event) => (
              <li key={event.id}>
                {new Date(event.createdAt).toLocaleString()} — {event.action}
                {event.note ? `: ${event.note}` : ""}
              </li>
            ))}
            {record.events.length === 0 ? <li>No history yet.</li> : null}
          </ul>
        </Section>
      ) : null}

      {record && isAdmin && record.status === "pending_approval" ? (
        <section className="flex flex-wrap items-end gap-2 rounded-lg border p-4">
          <Button
            type="button"
            onClick={() =>
              mutations.approve.mutate(record.id, {
                onSuccess: () => toast.success("TCF approved"),
                onError: (error) => toast.error(getErrorMessage(error)),
              })
            }
          >
            Approve
          </Button>
          <Input
            placeholder="Rejection reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              mutations.reject.mutate(
                { id: record.id, reason },
                {
                  onSuccess: () => toast.success("TCF rejected"),
                  onError: (error) => toast.error(getErrorMessage(error)),
                },
              )
            }
          >
            Reject
          </Button>
        </section>
      ) : null}

      {record && (record.status === "draft" || record.status === "rejected") ? (
        <section className="flex flex-wrap items-end gap-2 rounded-lg border p-4">
          <Field label="Request deletion (duplicate reason)">
            <Input
              value={duplicateReason}
              onChange={(event) => setDuplicateReason(event.target.value)}
              placeholder="Why this TCF should be removed"
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              mutations.remove.mutate(record.id, {
                onSuccess: () => {
                  toast.success(duplicateReason ? `Deleted. ${duplicateReason}` : "TCF deleted");
                  router.push("/tcf");
                },
                onError: (error) => toast.error(getErrorMessage(error)),
              })
            }
          >
            Delete TCF
          </Button>
        </section>
      ) : null}
    </div>
  );
}
