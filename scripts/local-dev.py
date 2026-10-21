#!/usr/bin/env python3
"""Mac/Linux 浏览器开发入口；使用正式 server 组合根，Go 管理 Agent 宿主。"""

import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent.parent
RUN = ROOT / ".local/dev"
STATE = RUN / "state.json"
DATA_ROOT = ROOT / ".local/project-workbench-debug"
BACKEND = RUN / "beeftv-server"
HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def read_state():
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def write_state(state):
    temporary = RUN / "state.json.tmp"
    temporary.write_text(json.dumps(state))
    temporary.replace(STATE)


def identity(pid):
    result = subprocess.run(["ps", "-p", str(pid), "-o", "lstart=,command="],
                            capture_output=True, text=True, check=False, env=dict(os.environ, LC_ALL="C"))
    return result.stdout.strip()


def owned(state):
    pid = state.get("pid", 0)
    return pid > 0 and bool(state.get("identity")) and identity(pid) == state["identity"]


def api_ok(url):
    try:
        with HTTP.open(url, timeout=2) as response:
            return json.load(response).get("code") == 0
    except (OSError, ValueError, urllib.error.URLError):
        return False


def ready(state):
    return (owned(state) and state.get("phase") == "running"
            and api_ok(state["backend"] + "/api/health/ready")
            and api_ok(state["url"] + "/api/workspace/bootstrap")
            and api_ok(state["url"] + "/api/ops"))


def tool(name, candidates):
    configured = os.environ.get("BEEFTV_DEV_" + name.upper())
    paths = [configured] if configured else [*map(str, candidates), shutil.which(name)]
    for path in paths:
        if path and Path(path).is_file() and os.access(path, os.X_OK):
            return str(Path(path).resolve())
    raise RuntimeError(f"未找到 {name}；请安装，或设置 BEEFTV_DEV_{name.upper()} 为可执行文件路径。")


def prepare():
    bun = tool("bun", sorted((ROOT / ".local/tools").glob("bun-*/bun-*/bun"), reverse=True))
    version = re.search(r"NODE_VERSION = '([^']+)'", (ROOT / "scripts/package-agent-host.mjs").read_text())[1]
    node = tool("node", (ROOT / ".local/tools").glob(f"node-v{version}-*/bin/node"))
    actual = subprocess.check_output([node, "--version"], text=True).strip()
    if actual != "v" + version:
        raise RuntimeError(f"Agent 需要 Node {version}，当前为 {actual}；请设置 BEEFTV_DEV_NODE。")
    go = tool("go", [])
    data = Path(os.environ.get("BEEFTV_DEV_DATA_DIR", DATA_ROOT / "daily")).resolve()
    if data != DATA_ROOT.resolve() and DATA_ROOT.resolve() not in data.parents:
        raise RuntimeError("开发数据目录必须位于 .local/project-workbench-debug 内。")
    data.mkdir(mode=0o700, parents=True, exist_ok=True)
    config_path = data / "agent_config.json"
    config = json.loads(config_path.read_text()) if config_path.exists() else {}
    # 开发入口固定使用当前检出的官方宿主；保留其他助手配置和模型凭据。
    config.update(hostCommand=node, hostArgs=[str(ROOT / "agent-host/server.mjs")])
    config_path.write_text(json.dumps(config, indent=2) + "\n")
    config_path.chmod(0o600)
    web_port = int(os.environ.get("BEEFTV_DEV_WEB_PORT", "3000"))
    backend_port = int(os.environ.get("BEEFTV_DEV_BACKEND_PORT", "8080"))
    for port in (web_port, backend_port):
        if not 1 <= port <= 65535:
            raise RuntimeError("开发端口必须在 1～65535 之间。")
        with socket.socket() as probe:
            # 与 Go/Vite 的监听语义一致，避免刚停止后的 TIME_WAIT 被误判为占用。
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                probe.bind(("127.0.0.1", port))
            except OSError as error:
                raise RuntimeError(f"端口 {port} 无法使用；请关闭占用服务或调整开发端口。") from error
    if web_port == backend_port:
        raise RuntimeError("前后端不能使用同一端口。")
    url, backend = f"http://127.0.0.1:{web_port}", f"http://127.0.0.1:{backend_port}"
    env = dict(os.environ, GOTOOLCHAIN="local", GOCACHE=str(ROOT / ".local/cache/go-build"),
               GOMODCACHE=str(ROOT / ".local/cache/go-mod"), BUN_INSTALL_CACHE_DIR=str(ROOT / ".local/cache/bun"),
               CANVAS_BACKEND_DATA_DIR=str(data), CANVAS_BACKEND_ADDR=f"127.0.0.1:{backend_port}",
               CANVAS_DATABASE_DRIVER="sqlite", DATABASE_URL="", CANVAS_AUTO_MIGRATE="true",
               CANVAS_OFFICIAL_PLUGIN_DIR=str(ROOT / "plugin-packages"),
               CANVAS_SHUTDOWN_TIMEOUT="20s", CANVAS_CORS_ORIGINS=url, BEEFTV_ALLOWED_ORIGINS=url,
               BEEFTV_UI_BOOTSTRAP="0", VITE_API_PROXY_TARGET=backend, VITE_CANVAS_BACKEND_URL="/api",
               VITE_BEEFTV_DEV_LOCAL_BACKEND="true",
               VITE_DESKTOP_LAUNCH_TOKEN="", GIN_MODE="release")
    env["PATH"] = os.pathsep.join([str(Path(bun).parent), str(Path(node).parent), env.get("PATH", "")])
    for directory, marker in [("web", "node_modules/.bin/vite"),
                              ("agent-host", "node_modules/@earendil-works/pi-durable/package.json")]:
        if not (ROOT / directory / marker).exists():
            print(f"安装 {directory} 依赖……", flush=True)
            subprocess.run([bun, "install", "--frozen-lockfile"], cwd=ROOT / directory, env=env, check=True)
    print("准备官方协议插件包……", flush=True)
    subprocess.run(["sh", str(ROOT / "plugin-packages/build-packages.sh")], cwd=ROOT, env=env, check=True)
    print("编译本地后端（复用 Go 缓存）……", flush=True)
    subprocess.run([go, "build", "-o", str(BACKEND), "./cmd/server"], cwd=ROOT / "backend", env=env, check=True)
    return env, data, url, backend, node, web_port


def serve():
    children = []
    stopping = False

    def request_stop(_signum, _frame):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    state = {"pid": os.getpid(), "identity": identity(os.getpid()), "phase": "starting",
             "url": os.environ["DEV_URL"], "backend": os.environ["VITE_API_PROXY_TARGET"],
             "data": os.environ["CANVAS_BACKEND_DATA_DIR"]}
    write_state(state)
    try:
        commands = [("backend", [str(BACKEND)], ROOT / "backend"),
                    ("web", [os.environ["DEV_NODE"], str(ROOT / "web/node_modules/vite/bin/vite.js"),
                             "--host", "127.0.0.1", "--port", os.environ["DEV_WEB_PORT"], "--strictPort"], ROOT / "web")]
        for name, command, cwd in commands:
            env = dict(os.environ)
            if name == "web":
                owner_file = Path(state["data"]) / "agent_owner_token"
                deadline = time.monotonic() + 30
                while not stopping and time.monotonic() < deadline:
                    if owner_file.is_file() and api_ok(state["backend"] + "/api/health/ready"):
                        break
                    if children[0].poll() is not None:
                        raise RuntimeError("后端提前退出，请查看日志。")
                    time.sleep(0.2)
                else:
                    raise RuntimeError("后端或本机开发凭据未就绪。")
                env["BEEFTV_DEV_OWNER_TOKEN_FILE"] = str(owner_file)
            with (RUN / f"{name}.log").open("a") as log:
                children.append(subprocess.Popen(command, cwd=cwd, stdout=log, stderr=subprocess.STDOUT,
                                                 stdin=subprocess.DEVNULL, start_new_session=True, env=env))
        state["phase"] = "running"
        write_state(state)
        while not stopping:
            if any(child.poll() is not None for child in children):
                raise RuntimeError("前后端进程提前退出，请查看日志。")
            time.sleep(0.3)
    finally:
        # 只操作本启动器仍持有的子进程；先停 Vite，后端自行关闭 Go 管理的 Node 宿主。
        for child in reversed(children):
            if child.poll() is None:
                child.terminate()
        deadline = time.monotonic() + 35
        for child in reversed(children):
            try:
                child.wait(timeout=max(0.1, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait()
        if read_state().get("pid") == os.getpid():
            STATE.unlink(missing_ok=True)


def stop():
    state = read_state()
    if not owned(state):
        print("当前没有由本启动器运行的服务。")
        return
    os.kill(state["pid"], signal.SIGTERM)
    deadline = time.monotonic() + 45
    while owned(state) and time.monotonic() < deadline:
        time.sleep(0.2)
    if owned(state):
        raise RuntimeError("服务仍在退出，请查看日志后重试；未强杀其他进程。")
    print("已停止前后端及其管理的 Agent 宿主，项目数据已保留。")


def dev():
    state = read_state()
    if ready(state):
        print(f"项目已在运行：{state['url']}")
    else:
        if owned(state):
            stop()
        env, data, url, backend, node, port = prepare()
        env.update(DEV_URL=url, DEV_NODE=node, DEV_WEB_PORT=str(port))
        with (RUN / "launcher.log").open("a") as log:
            process = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "serve"], cwd=ROOT,
                                       env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
                                       start_new_session=True)
        try:
            deadline = time.monotonic() + 90
            while time.monotonic() < deadline:
                state = read_state()
                if process.poll() is not None:
                    raise RuntimeError("启动失败，请运行 make logs 查看详情。")
                if ready(state):
                    break
                time.sleep(0.5)
            else:
                raise RuntimeError("启动等待超时，请运行 make logs 查看详情。")
        except BaseException:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=45)
            raise
        print(f"已启动：{url}\n数据：{data}\n停止：make stop；查看日志：make logs")
    if os.environ.get("BEEFTV_DEV_OPEN", "1") != "0":
        webbrowser.open(state["url"])


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "dev"
    RUN.mkdir(mode=0o700, parents=True, exist_ok=True)
    if command == "serve":
        serve()
    elif command == "logs":
        logs = [RUN / f"{name}.log" for name in ("launcher", "backend", "web")]
        for path in logs:
            path.touch(mode=0o600, exist_ok=True)
        subprocess.run(["tail", "-n", "30", "-F", *map(str, logs)], check=False)
    elif command == "status":
        state = read_state()
        if owned(state):
            print(f"{'运行中' if ready(state) else '启动中或服务异常'}：{state['url']}\n数据：{state['data']}\n日志：{RUN}")
        else:
            print("未运行。执行 make dev 启动。")
    elif command in ("dev", "stop", "restart"):
        with (RUN / "control.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            if command in ("stop", "restart"):
                stop()
            if command in ("dev", "restart"):
                dev()
    else:
        raise RuntimeError("用法：local-dev.py dev|stop|restart|status|logs")


if __name__ == "__main__":
    os.umask(0o077)
    try:
        main()
    except KeyboardInterrupt:
        print("\n已退出当前命令。")
        sys.exit(130)
    except BlockingIOError:
        print("另一个启动或停止命令正在执行，请稍后重试。", file=sys.stderr)
        sys.exit(1)
    except (RuntimeError, OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"错误：{error}", file=sys.stderr)
        sys.exit(1)
