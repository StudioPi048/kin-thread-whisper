import re

with open("src/routes/_authenticated.app.clientes.$clientId.tsx", "r") as f:
    content = f.read()

# Replace static imports with lazy imports
imports_to_remove = [
    """import { ClientTimeline } from "@/components/clients/client-timeline";""",
    """import { CaseDashboard } from "@/components/clients/case-dashboard";""",
    """import { PatternsPanel } from "@/components/clients/patterns-panel";""",
    """import { GenogramCanvas } from "@/components/genogram/genogram-canvas";""",
    """import { ClanSpreadsheet } from "@/components/genogram/clan-spreadsheet";""",
    """import { IntakeForm } from "@/components/intake/intake-form";""",
    """import { SessionsPanel } from "@/components/sessions/sessions-panel";"""
]

lazy_imports = """
import { lazy, Suspense } from "react";
const ClientTimeline = lazy(() => import("@/components/clients/client-timeline").then(m => ({ default: m.ClientTimeline })));
const CaseDashboard = lazy(() => import("@/components/clients/case-dashboard").then(m => ({ default: m.CaseDashboard })));
const PatternsPanel = lazy(() => import("@/components/clients/patterns-panel").then(m => ({ default: m.PatternsPanel })));
const GenogramCanvas = lazy(() => import("@/components/genogram/genogram-canvas").then(m => ({ default: m.GenogramCanvas })));
const ClanSpreadsheet = lazy(() => import("@/components/genogram/clan-spreadsheet").then(m => ({ default: m.ClanSpreadsheet })));
const IntakeForm = lazy(() => import("@/components/intake/intake-form").then(m => ({ default: m.IntakeForm })));
const SessionsPanel = lazy(() => import("@/components/sessions/sessions-panel").then(m => ({ default: m.SessionsPanel })));
"""

for imp in imports_to_remove:
    content = content.replace(imp, "")

content = content.replace('import { useEffect, useState } from "react";', 'import { useEffect, useState } from "react";\n' + lazy_imports)

# Add Suspense boundary helper
suspense_helper = """
function TabSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-plum border-r-transparent"></div></div>}>
      {children}
    </Suspense>
  );
}
"""
content = content.replace('export const Route =', suspense_helper + '\nexport const Route =')

# Wrap components in TabSuspense
components = ['ClientTimeline', 'CaseDashboard', 'PatternsPanel', 'GenogramCanvas', 'ClanSpreadsheet', 'IntakeForm', 'SessionsPanel']
for comp in components:
    # Need to find usages like <ClientTimeline ... /> and wrap them
    # Because they might have multiple props spanning multiple lines, we'll use a regex
    content = re.sub(rf"(<{comp}\b[^>]*?(?:/>|>[\s\S]*?</{comp}>))", r"<TabSuspense>\1</TabSuspense>", content)

with open("src/routes/_authenticated.app.clientes.$clientId.tsx", "w") as f:
    f.write(content)
print("Optimized route imports")
