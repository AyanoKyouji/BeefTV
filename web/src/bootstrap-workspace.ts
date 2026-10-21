import { bootstrapAppearance } from "@/services/appearance-bootstrap";
import { bootstrapDesktopRuntime } from "@/services/desktop-runtime";

export async function startApplication() {
    await bootstrapDesktopRuntime();
    // The workspace hydrator selects the backend's namespace before loading
    // its canvas cache and documents. The last WebView scope may belong to a
    // different data directory.
    await bootstrapAppearance().catch(() => console.warn("外观初始化未完成，继续打开工作区"));
    await import("./application");
}
