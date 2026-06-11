# PropNinja v1 — User Playbook

Practical guide for day-to-day use of the web dashboard and mobile app. For technical setup, see [README.md](README.md). For ad platform wiring, see [INTEGRATIONS.md](INTEGRATIONS.md).

---

## For Admins

### Log in

1. Open the web app (e.g. your team’s PropNinja URL).
2. Sign in with the email and password your organisation provisioned.
3. You should see **Dashboard**, **Leads**, **Projects**, **Users**, and **Settings** in the sidebar.

There is no self-registration — admins create accounts for the team.

### Add agents and managers

1. Go to **Users** in the sidebar.
2. Click **Add user** (or open an existing user to edit).
3. Fill in name, email, username, and password.
4. Set **Role** to **Agent** (field sales) or **Manager** (team oversight).
5. Leave **Active** on unless you need to suspend access.
6. Save. Share login details with the person securely.

Only admins can create other admins or change someone to the Admin role.

### Configure basic settings

| Area | Where | What to do |
|------|--------|------------|
| **Organisation** | **Settings** | View org name and plan (read-only in v1). |
| **Users & roles** | **Users** | Add/edit team members, roles, active status. |
| **Projects** | **Projects** | Add developments or listings agents can attach to leads. |
| **Reports** | **Reports** | No global “report settings” — use date filters on each report page. Ensure managers know which reports they can open. |
| **TCF consent** | **Lead detail** → consent panel | On any lead, set **Call**, **SMS**, and **Email** consent. Agents see this on mobile before dialing. |

**Audit log (admin):** **Settings → View audit log** shows who changed users, deleted leads, edited projects, or updated TCF.

### Connect ad integrations (high level)

Ad leads from Facebook/Instagram and Google Ads flow into **Leads** automatically once the API is configured.

1. Work with your technical contact to set API credentials (Meta webhook + Google Ads sync).
2. In the web app, open **Settings → Integrations** to confirm status is **Configured**.
3. After go-live, use **Leads → Ad Leads** filter or dashboard **Leads from Source** to verify new leads arriving.

Detailed steps and env vars: [INTEGRATIONS.md](INTEGRATIONS.md).

---

## For Agents

### Web — see your assigned leads

1. Sign in to the web app.
2. Open **Leads**.
3. Your list is scoped to **leads assigned to you** (managers and admins see more).
4. Useful filters:
   - **Scope** — e.g. mine vs all (if your role allows).
   - **Stage** — pipeline status (New, Contacted, Qualified, etc.).
   - **Search** — name, phone, email.
   - **Advanced filters** — source, project, date range, follow-up dates.
5. Click a row to open **Lead detail**.

### Web — call history and notes

On **Lead detail**:

- **Timeline / activities** — status changes, notes, and ad-lead events.
- **Calls** — calls logged from the mobile app (time, duration, disposition).
- **Notes** — add a note from the lead page; it appears on the timeline.

Outbound calling is **not** done from the web — use the mobile app and your SIM.

### Mobile — log in

1. Install the PropNinja mobile app (Expo build or internal distribution).
2. Enter the same email and password as the web app.
3. You land on **Home** with shortcuts to **Leads**, **Today**, and **Profile**.

### Mobile — call via SIM and log calls

1. Open a lead from **Leads** or **Today**.
2. Check the **TCF** chip (OK to call / Do not call / unknown).
3. Tap **Call** — the device dialer opens with the lead’s number.
4. After the call, when you return to the app, a **log call** sheet may open automatically (short calls). You can also tap **Log** or **Log Last Call** manually.
5. Choose disposition (e.g. completed, missed), add notes, and save.

Calls appear on the lead in web and mobile once logged.

### Mobile — Today queue

1. Open **Today** from the bottom tab or home.
2. You see leads with **follow-ups due** (assigned to you).
3. Tap a card for lead detail, **Call**, or **Log** — same flow as above.
4. Work the list top to bottom; update follow-up dates on the lead when you reschedule.

---

## For Managers

### What to check daily

| When | Where | Why |
|------|--------|-----|
| Morning | **Dashboard** | KPI strip, **Today at a glance**, hot leads, reminders. |
| Morning | **Reports → Team** | Who called, completed calls, leads touched, deals won **today**. |
| During day | **Leads** | Reassign stuck leads; filter by stage or “unassigned”. |
| End of day | **Reports → Calls** | Per-agent call volume and talk time for the period. |
| As needed | **Leads from Source** (dashboard) | Volume from website, referrals, **Facebook Ads**, **Google Ads**. |

Use the **bell icon** in the top bar for assignment and follow-up notifications.

### Call reports — how to read them

1. Go to **Reports → Calls** (Leads – Call Report).
2. Set the **date range** (today, this week, custom).
3. Review the table **per user**:
   - **Calls** — attempt count.
   - **Completed / missed** — outcome mix.
   - **Talk time** — engagement depth.
4. Use **filters** (user, campaign if ad leads) and **Export CSV** for stand-ups or payroll evidence.

Low call counts with many assigned leads may mean follow-up gaps; high missed rates may mean bad timing or data quality.

### Lead pipeline — how to interpret it

1. **Dashboard** and **Reports → Leads** show counts by status and source over time.
2. On **Leads**, use **Stage** tabs or filters:
   - **New** — not yet worked.
   - **Contacted / Qualified** — active pipeline.
   - **Negotiation** — late stage.
   - **Won / Lost** — closed outcomes.
3. Drill from dashboard **Leads from Source** into filtered lead lists (including **All Ad Leads**).
4. Assign or reassign from lead detail or bulk actions where available.

A healthy pipeline has steady movement from New → Contacted → Qualified; leads sitting in New with past follow-up dates need manager attention.

---

## Quick reference

| Role | Web focus | Mobile focus |
|------|-----------|--------------|
| **Admin** | Users, settings, integrations, audit | Optional — same login if needed |
| **Manager** | Dashboard, reports, team metrics, assignment | Optional — oversight on the go |
| **Agent** | Lead lookup, notes, history | **Today**, SIM calls, call logging |

**Support:** For login issues or missing leads, contact your admin. For ad leads not appearing, check **Settings → Integrations** and [INTEGRATIONS.md](INTEGRATIONS.md).
