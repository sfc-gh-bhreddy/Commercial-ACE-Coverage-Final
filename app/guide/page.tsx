import type { Metadata } from "next";

export const metadata: Metadata = { title: "Guide & Legend" };

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

export default function GuidePage() {
  return (
    <main className="w-full max-w-2xl mx-auto py-10 px-8">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Guide & Legend</h1>
      <p className="text-sm text-muted-foreground mb-8">
        How to read this app and what the suggestions mean.
      </p>

      {/* Intent */}
      <div
        className="rounded-xl border px-5 py-4 mb-8 text-sm leading-relaxed"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <p>
          The suggestions on this app are <strong>starting points</strong>, not instructions.
          They surface uncovered Cap1 accounts and recommend a next action based on deal size,
          consumption stage, and partner signals. <strong>If you see a clear need to assign an
          ASE, go ahead — don't wait for the app to tell you.</strong> Use your own judgment
          and knowledge of the account first.
        </p>
      </div>

      <div className="flex flex-col gap-8">

        {/* Suggested plays */}
        <Section title="Suggested plays">
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex items-start gap-3">
              <Pill label="ASE" bg="#dbeafe" fg="#1e40af" />
              <div>
                <p className="font-medium mb-0.5">Assign an Account Engineer</p>
                <p className="text-muted-foreground">
                  Deal ACV is $50K or above. The account warrants direct human coverage — open a
                  TMR to assign an ASE.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Pill label="Bluebird" bg="#dcfce7" fg="#166534" />
              <div>
                <p className="font-medium mb-0.5">BOB self-service program</p>
                <p className="text-muted-foreground">
                  Sub-$50K deal. Enroll the account in the Bluebird Book of Business activation
                  program. Still consider an ASE if you have signal that the account needs more
                  hands-on help.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Pill label="Webinar" bg="#fef9c3" fg="#854d0e" />
              <div>
                <p className="font-medium mb-0.5">Topic webinar invite</p>
                <p className="text-muted-foreground">
                  A relevant Snowflake webinar topic was detected from the opportunity (AI, Data
                  Engineering, Analytics, etc.). Invite the customer to the next session or share
                  the on-demand recording.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Pill label="SI involved" bg="#f3e8ff" fg="#6b21a8" />
              <div>
                <p className="font-medium mb-0.5">Systems integrator or partner detected</p>
                <p className="text-muted-foreground">
                  A partner appears to be handling implementation on this account, so no ASE
                  action is suggested. <strong>This is a signal, not a guarantee.</strong> It is
                  detected from open use-case partner attachment or an approved Salesforce deal
                  registration ("SPN: Deal Registrations" on the opportunity). Always verify in
                  Salesforce before skipping outreach — the partner data is not always current.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* Coverage signals */}
        <Section title="What counts as covered">
          <p className="text-sm text-muted-foreground leading-relaxed">
            An account is marked <strong>Covered</strong> if <em>any one</em> of the following
            signals exists in Salesforce or Elementum:
          </p>
          <ul className="text-sm text-muted-foreground flex flex-col gap-1.5 list-disc list-inside">
            <li>A TMR (Team Member Request) assignment in Elementum</li>
            <li>An activation tag on the account</li>
            <li>An ACE assigned to the Salesforce use-case team</li>
            <li>An ASE role on the Salesforce account team</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Only one signal is needed. The coverage date shown is the earliest date any signal
            appeared — before or on close date means the account was covered at deal close.
          </p>
        </Section>

        {/* Consumption stages */}
        <Section title="Consumption stages">
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div><span className="font-medium text-foreground">Not Started</span> — no revenue recorded since close.</div>
            <div><span className="font-medium text-foreground">Started Slow</span> — some consumption but under $200 in the last 30 days.</div>
            <div><span className="font-medium text-foreground">Ramping</span> — between $200 and $5K in the last 30 days.</div>
            <div><span className="font-medium text-foreground">Mature</span> — over $5K in the last 30 days, consumption is healthy.</div>
          </div>
          <p className="text-sm text-muted-foreground">
            Consumption is trailing 12 months, matching the A360 app tile.
          </p>
        </Section>

        {/* Data freshness */}
        <Section title="Data freshness">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Data is cached on the server for 10 minutes. To force a refresh, do a hard reload
            (<kbd className="rounded border px-1.5 py-0.5 text-[11px] font-mono" style={{ borderColor: "var(--border)" }}>⌘ Shift R</kbd>).
            Coverage signals and consumption figures update as Salesforce and A360 sync — typically within a few hours of a real change.
          </p>
        </Section>

      </div>
    </main>
  );
}
