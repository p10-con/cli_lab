#!/usr/bin/env python3
"""
cli_lab ディスパッチャー

使い方:
  python lab.py <username> <tool> [args...]
  python lab.py --list
"""

import sys
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent
COMMANDS_DIR = ROOT / "commands"


def discover_tools() -> dict:
    tools = {}
    for tool_json in sorted(COMMANDS_DIR.glob("*/*/tool.json")):
        username = tool_json.parent.parent.name
        toolname = tool_json.parent.name
        try:
            config = json.loads(tool_json.read_text(encoding="utf-8"))
            tools[(username, toolname)] = {
                "path": tool_json.parent,
                "config": config,
            }
        except json.JSONDecodeError:
            print(f"[lab] 警告: {tool_json} の JSON が不正です。スキップします。")
    return tools


def show_help(tools: dict) -> None:
    print("使い方: python lab.py <username> <tool> [args...]")
    print()
    if not tools:
        print("  まだツールがありません。commands/{username}/{tool}/tool.json を追加してください。")
        return
    print("利用可能なツール:")
    for (username, toolname), info in tools.items():
        desc = info["config"].get("description", "")
        print(f"  {username}/{toolname:<20} {desc}")


def run_install(tool_path: Path, install_cmd: str) -> bool:
    marker = tool_path / ".installed"
    if marker.exists():
        return True
    print(f"[lab] 初回セットアップ: {install_cmd}")
    result = subprocess.run(install_cmd, shell=True, cwd=tool_path)
    if result.returncode != 0:
        print("[lab] セットアップ失敗。手動で確認してください。")
        return False
    marker.touch()
    return True


def main() -> None:
    args = sys.argv[1:]

    if not args or args[0] in ("-h", "--help"):
        show_help(discover_tools())
        sys.exit(0)

    if args[0] == "--list":
        show_help(discover_tools())
        sys.exit(0)

    if len(args) < 2:
        print("エラー: username と tool の両方を指定してください。")
        show_help(discover_tools())
        sys.exit(1)

    username, toolname, *rest = args
    tools = discover_tools()
    key = (username, toolname)

    if key not in tools:
        print(f"[lab] ツールが見つかりません: {username}/{toolname}")
        print()
        show_help(tools)
        sys.exit(1)

    tool_path: Path = tools[key]["path"]
    config: dict = tools[key]["config"]

    # 初回インストール
    install_cmd = config.get("install")
    if install_cmd and not run_install(tool_path, install_cmd):
        sys.exit(1)

    # 実行
    run_cmd = config.get("run")
    if not run_cmd:
        print(f"[lab] tool.json に 'run' が定義されていません: {username}/{toolname}")
        sys.exit(1)

    if rest:
        run_cmd = run_cmd + " " + " ".join(rest)

    result = subprocess.run(run_cmd, shell=True, cwd=tool_path)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
