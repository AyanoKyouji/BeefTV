import { describe, expect, test } from "bun:test";

import { attachNodeToStoryboardRow, createCanvasNode, createStoryboardRow, expandStoryboardTextMentions } from "../src/lib/canvas/canvas-project-domain";
import type { CanvasResourceReference } from "../src/lib/canvas/canvas-resource-references";
import { CanvasNodeType } from "../src/types/canvas";

test("explicitly linking a new image clears the row's stale-image notice", () => {
    const row = { ...createStoryboardRow(1), imageBindingStale: true };
    const script = createCanvasNode(CanvasNodeType.Script, { x: 0, y: 0 }, { storyboard: { rows: [row], visibleColumns: [], referenceNodeIds: [] } });
    const image = createCanvasNode(CanvasNodeType.Image, { x: 500, y: 0 });
    const linked = attachNodeToStoryboardRow([script, image], { fromNodeId: script.id, toNodeId: image.id, fromHandleId: "row:" + row.id });
    const saved = linked.find((node) => node.id === script.id)!.metadata!.storyboard!.rows[0];
    expect(saved.imageNodeId).toBe(image.id);
    expect(saved.imageBindingStale).toBeUndefined();
});

describe("expandStoryboardTextMentions", () => {
    test("展开引用控件保存的 canonical node token", () => {
        const references: CanvasResourceReference[] = [{
            id: "script-node",
            nodeId: "script-node",
            kind: "text",
            label: "文本1",
            title: "完整剧本",
            text: "第一场：主角推开仓库大门。",
            active: true,
        }];

        expect(expandStoryboardTextMentions("@[node:script-node] 拆成 8 个镜头", references)).toBe(
            "【项目设定：完整剧本】\n第一场：主角推开仓库大门。 拆成 8 个镜头",
        );
    });
});
