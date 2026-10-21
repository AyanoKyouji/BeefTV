import { startApplication } from "../../src/bootstrap-workspace";
import { setActiveUserScope, getActiveUserScope } from "@/lib/user-scope";
import { localForageStorageForScope } from "@/lib/localforage-storage";
import { useCanvasStore, flushCanvasStorePersistence, CANVAS_STORE_KEY } from "@/stores/canvas/use-canvas-store";
import { recordConfirmedCanvasCommit } from "@/services/canvas-operation-journal";

setActiveUserScope("previous-workspace");
await useCanvasStore.persist.rehydrate();
const id = useCanvasStore.getState().createProject("Previous canvas");
await recordConfirmedCanvasCommit(useCanvasStore.getState().openProject(id)!);
await flushCanvasStorePersistence();
await startApplication();
(window as any).__scopeResult = {
    scope: getActiveUserScope(),
    projects: useCanvasStore.getState().projects,
    previousCache: JSON.parse((await localForageStorageForScope("previous-workspace").getItem(CANVAS_STORE_KEY))!),
    misplacedJournal: await localForageStorageForScope("previous-workspace").getItem("canvas-document-journal:current-canvas"),
};
