import { useState } from "react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ChangeEvent,
} from "react";
import { Badge as NitroBadge, Button as NitroButton, DrawerPopup, EmptyList, InputText, TextArea } from "@idp/nitro-redwood";
import { cn } from "../lib/utils";

export function Button({
  className,
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "ghost" | "danger" }) {
  const chroming = variant === "primary" ? "callToAction" : variant === "danger" ? "danger" : variant === "ghost" ? "borderless" : "outlined";
  return (
    <NitroButton
      chroming={chroming}
      className={cn("inline-flex items-center justify-center gap-2", className)}
      isDisabled={props.disabled}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("nitro-helpdesk-card", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-[#ded9cf] p-5", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function Badge({ className, children }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <NitroBadge variant="neutralSubtle" size="sm" className={cn("status-badge", className)}>
      {children}
    </NitroBadge>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  if (props.type === "file" || props.type === "checkbox" || props.type === "radio") {
    return <input {...props} className={cn("input-base", props.className)} />;
  }

  const value = props.value == null || Array.isArray(props.value) ? undefined : String(props.value);
  const defaultValue = props.defaultValue == null || Array.isArray(props.defaultValue) ? undefined : String(props.defaultValue);

  return (
    <InputText
      id={props.id}
      name={props.name}
      type={props.type}
      value={value}
      defaultValue={defaultValue}
      placeholder={props.placeholder}
      disabled={props.disabled}
      required={props.required}
      autoComplete={props.autoComplete}
      autoFocus={props.autoFocus}
      maxLength={props.maxLength}
      className={cn("nitro-helpdesk-field", props.className)}
      onChange={(nextValue) => {
        props.onChange?.({
          target: { value: nextValue },
          currentTarget: { value: nextValue },
        } as unknown as ChangeEvent<HTMLInputElement>);
      }}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const value = props.value == null || Array.isArray(props.value) ? undefined : String(props.value);
  const defaultValue = props.defaultValue == null || Array.isArray(props.defaultValue) ? undefined : String(props.defaultValue);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const renderedValue = value ?? internalValue;

  return (
    <>
      <TextArea
        id={props.id}
        value={renderedValue}
        placeholder={props.placeholder}
        disabled={props.disabled}
        required={props.required}
        rows={props.rows}
        className={cn("nitro-helpdesk-field min-h-24", props.className)}
        onChange={(nextValue) => {
          if (value === undefined) {
            setInternalValue(nextValue);
          }
          props.onChange?.({
            target: { value: nextValue },
            currentTarget: { value: nextValue },
          } as unknown as ChangeEvent<HTMLTextAreaElement>);
        }}
      />
      {props.name ? <input type="hidden" name={props.name} value={renderedValue} /> : null}
    </>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("input-base", props.className)} />;
}

export function Drawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <DrawerPopup open title={title} edge="end" modality="modal" size="md" closeButton onClose={onClose} contentClassName="nitro-helpdesk-drawer-body">
      {children}
    </DrawerPopup>
  );
}

export function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <EmptyList aria-label={title} className="nitro-helpdesk-empty">
      <div className="text-sm font-semibold text-[#1f1f1f]">{title}</div>
      <p className="mt-2 text-sm leading-6 text-[#6f6f6f]">{text}</p>
    </EmptyList>
  );
}
