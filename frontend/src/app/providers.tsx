"use client";

import React from "react";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";

const runtimeUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/copilotkit`;

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit runtimeUrl={runtimeUrl} agent="default" showDevConsole={false} enableInspector={false}>
      {children}
    </CopilotKit>
  );
}
