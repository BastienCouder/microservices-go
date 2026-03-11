import Link from "next/link";
import type { ReactNode } from "react";

type Tone = "default" | "primary" | "muted";

type NoteBoxProps = {
  title: string;
  tone?: Tone;
  children: ReactNode;
};

type PanelCardProps = {
  title: string;
  href?: string;
  kicker?: string;
  children: ReactNode;
};

type EndpointRowProps = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  auth?: string;
  scope?: string;
  response?: string;
  children: ReactNode;
};

type ToolCardProps = {
  name: string;
  transport?: string;
  input?: string;
  output?: string;
  children: ReactNode;
};

type OperationHeaderProps = {
  tag?: string;
  title: string;
  summary: string;
  method: string;
  path: string;
};

type ExamplePanelProps = {
  title: string;
  eyebrow?: string;
  children: ReactNode;
};

function toneClassName(tone: Tone) {
  switch (tone) {
    case "primary":
      return "platform-note platform-note--primary";
    case "muted":
      return "platform-note platform-note--muted";
    default:
      return "platform-note";
  }
}

function methodClassName(method: EndpointRowProps["method"]) {
  return `platform-method platform-method--${method.toLowerCase()}`;
}

export function NoteBox({ title, tone = "default", children }: NoteBoxProps) {
  return (
    <aside className={toneClassName(tone)}>
      <p className="platform-note-title">{title}</p>
      <div className="platform-note-body">{children}</div>
    </aside>
  );
}

export function PanelGrid({ children }: { children: ReactNode }) {
  return <div className="platform-panel-grid">{children}</div>;
}

export function PanelCard({ title, href, kicker, children }: PanelCardProps) {
  return (
    <article className="platform-panel-card">
      {kicker ? <p className="platform-panel-kicker">{kicker}</p> : null}
      <h3>{title}</h3>
      <div className="platform-panel-body">{children}</div>
      {href ? (
        <Link className="platform-panel-link" href={href}>
          Read section
        </Link>
      ) : null}
    </article>
  );
}

export function EndpointTable({ children }: { children: ReactNode }) {
  return <div className="platform-endpoint-table">{children}</div>;
}

export function EndpointRow({
  method,
  path,
  auth = "Session",
  scope,
  response,
  children,
}: EndpointRowProps) {
  return (
    <article className="platform-endpoint-row">
      <div className="platform-endpoint-top">
        <div className="platform-endpoint-line">
          <span className={methodClassName(method)}>{method}</span>
          <code className="platform-endpoint-path">{path}</code>
        </div>

        <div className="platform-endpoint-meta">
          <span className="platform-badge">Auth: {auth}</span>
          {scope ? <span className="platform-badge">Scope: {scope}</span> : null}
          {response ? <span className="platform-badge">Returns: {response}</span> : null}
        </div>
      </div>

      <div className="platform-endpoint-body">{children}</div>
    </article>
  );
}

export function ToolGrid({ children }: { children: ReactNode }) {
  return <div className="platform-tool-grid">{children}</div>;
}

export function ToolCard({ name, transport, input, output, children }: ToolCardProps) {
  return (
    <article className="platform-tool-card">
      <div className="platform-tool-head">
        <code>{name}</code>
      </div>
      <div className="platform-tool-body">{children}</div>
      <div className="platform-tool-meta">
        {transport ? <span className="platform-badge">Transport: {transport}</span> : null}
        {input ? <span className="platform-badge">Input: {input}</span> : null}
        {output ? <span className="platform-badge">Output: {output}</span> : null}
      </div>
    </article>
  );
}

export function ReferenceShell({ children }: { children: ReactNode }) {
  return <div className="platform-reference-shell">{children}</div>;
}

export function ReferenceMain({ children }: { children: ReactNode }) {
  return <div className="platform-reference-main">{children}</div>;
}

export function ReferenceAside({ children }: { children: ReactNode }) {
  return <aside className="platform-reference-aside">{children}</aside>;
}

export function OperationHeader({
  tag = "Reference",
  title,
  summary,
  method,
  path,
}: OperationHeaderProps) {
  return (
    <header className="platform-operation-header">
      <p className="platform-operation-tag">{tag}</p>
      <h1>{title}</h1>
      <p className="platform-operation-summary">{summary}</p>
      <div className="platform-operation-pill">
        <span className="platform-operation-method">{method}</span>
        <code>{path}</code>
      </div>
    </header>
  );
}

export function ExamplePanel({ title, eyebrow, children }: ExamplePanelProps) {
  return (
    <section className="platform-example-panel">
      <div className="platform-example-head">
        <div>
          {eyebrow ? <p className="platform-example-eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
        </div>
      </div>
      <div className="platform-example-body">{children}</div>
    </section>
  );
}
