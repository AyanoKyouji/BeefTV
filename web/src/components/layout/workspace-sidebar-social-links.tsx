import { Tooltip } from "antd";
import Github from "@lobehub/icons/es/Github";

export function WorkspaceSidebarSocialLinks() {
    return (
        <div className="app-workspace-social-links">
            <Tooltip title="YUNTV 项目源码" placement="top">
                <a className="app-workspace-social-action" href="https://github.com/AyanoKyouji/BeefTV" target="_blank" rel="noopener noreferrer" aria-label="打开 YUNTV 项目源码">
                    <Github aria-hidden="true" />
                </a>
            </Tooltip>
            <Tooltip title="YUNTV 基于 BeefTV 开源项目开发，感谢原作者与贡献者。" placement="top">
                <a className="app-workspace-social-action" href="https://github.com/glanderness/BeefTV" target="_blank" rel="noopener noreferrer" aria-label="查看开源项目来源与致谢">
                    <span aria-hidden="true">©</span>
                </a>
            </Tooltip>
        </div>
    );
}
