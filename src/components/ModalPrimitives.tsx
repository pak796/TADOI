import React from "react";
import type { RuntimeTheme } from "../app/theme";

export type ModalTone = "neutral" | "warning";

type ModalContainerProps = {
  theme: RuntimeTheme;
  tone?: ModalTone;
  width?: number;
  minWidth?: number;
  gap?: number;
  children: React.ReactNode;
};

type ModalActionRowProps = {
  marginTop?: number;
  gap?: number;
  children: React.ReactNode;
};

type ModalActionButtonProps = {
  theme: RuntimeTheme;
  tone?: ModalTone;
  label: string;
  onPress: () => void;
  primary?: boolean;
  active?: boolean;
  paddingX?: number;
};

export function ModalContainer({
  theme,
  tone = "neutral",
  width,
  minWidth,
  gap = 1,
  children
}: ModalContainerProps) {
  const warningTone = tone === "warning";
  return (
    <box
      style={{
        padding: 2,
        backgroundColor: warningTone ? theme.warn : theme.panel,
        color: warningTone ? theme.bg : theme.text,
        border: true,
        borderStyle: "single",
        borderColor: warningTone ? theme.bg : theme.outline,
        width,
        minWidth,
        flexDirection: "column",
        gap
      }}
    >
      {children}
    </box>
  );
}

export function ModalActionRow({ marginTop, gap = 1, children }: ModalActionRowProps) {
  return (
    <box
      style={{
        flexDirection: "row",
        gap,
        justifyContent: "center",
        width: "100%",
        marginTop
      }}
    >
      {children}
    </box>
  );
}

export function ModalActionButton({
  theme,
  tone = "neutral",
  label,
  onPress,
  primary = false,
  active = false,
  paddingX = 2
}: ModalActionButtonProps) {
  const warningTone = tone === "warning";
  const highlighted = !warningTone && (primary || active);
  const backgroundColor = warningTone ? theme.bg : highlighted ? theme.accentBlue : theme.panel;
  const borderColor = warningTone ? theme.warn : highlighted ? theme.accentBlue : theme.outline;
  const textColor = warningTone ? theme.warn : highlighted ? theme.bg : theme.text;

  return (
    <box
      style={{
        backgroundColor,
        border: true,
        borderStyle: "single",
        borderColor,
        paddingLeft: paddingX,
        paddingRight: paddingX
      }}
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        onPress();
      }}
    >
      <text
        style={{
          color: textColor,
          fontWeight: "bold"
        }}
      >
        {label}
      </text>
    </box>
  );
}
