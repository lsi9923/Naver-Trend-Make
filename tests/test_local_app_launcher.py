from __future__ import annotations

import importlib.util
import pathlib
import unittest
from unittest.mock import Mock, patch


PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = PROJECT_ROOT / "local_app_launcher.py"


def load_launcher_module():
    spec = importlib.util.spec_from_file_location("local_app_launcher_under_test", MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {MODULE_PATH}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class LocalAppLauncherTests(unittest.TestCase):
    def test_start_local_api_does_not_require_shopping_env_file(self) -> None:
        launcher = load_launcher_module()
        process = Mock()

        with (
            patch.object(launcher, "is_port_open", return_value=False),
            patch.object(launcher, "stop_stale_local_api_processes"),
            patch.object(launcher, "run_schema_setup"),
            patch.object(launcher, "wait_for_api", return_value=True),
            patch.object(launcher.subprocess, "Popen", return_value=process) as popen,
        ):
            started_process = launcher.start_local_api()

        self.assertIs(started_process, process)
        command = popen.call_args.args[0]
        self.assertNotIn("--env-file", command)
        self.assertNotIn("NAVER_CLIENT_ID", " ".join(command))
        self.assertNotIn("NAVER_CLIENT_SECRET", " ".join(command))

    def test_existing_api_port_must_pass_health_check(self) -> None:
        launcher = load_launcher_module()

        with (
            patch.object(launcher, "is_port_open", return_value=True),
            patch.object(launcher, "wait_for_api", return_value=False) as wait_for_api,
        ):
            with self.assertRaisesRegex(RuntimeError, "로컬 API 포트"):
                launcher.start_local_api()

        wait_for_api.assert_called_once()

    def test_existing_api_port_without_best_product_endpoint_is_restarted(self) -> None:
        launcher = load_launcher_module()
        process = Mock()

        with (
            patch.object(launcher, "is_port_open", side_effect=[True, False]),
            patch.object(launcher, "wait_for_api", return_value=True),
            patch.object(launcher, "is_best_products_api_ready", return_value=False),
            patch.object(launcher, "stop_stale_local_api_processes") as stop_stale_local_api_processes,
            patch.object(launcher, "run_schema_setup") as run_schema_setup,
            patch.object(launcher.subprocess, "Popen", return_value=process),
        ):
            started_process = launcher.start_local_api()

        self.assertIs(started_process, process)
        stop_stale_local_api_processes.assert_called()
        run_schema_setup.assert_called_once_with()

    def test_shutdown_handler_closes_every_runtime_resource(self) -> None:
        launcher = load_launcher_module()
        root = Mock()
        ui_server = Mock()
        api_process = Mock()
        api_process_ref = {"api_process": api_process}
        pump_stop_event = Mock()

        with patch.object(launcher, "stop_process_tree") as stop_process_tree:
            shutdown = launcher.build_shutdown_handler(root, ui_server, api_process_ref, pump_stop_event)
            shutdown()

        pump_stop_event.set.assert_called_once_with()
        ui_server.shutdown.assert_called_once_with()
        ui_server.server_close.assert_called_once_with()
        stop_process_tree.assert_called_once_with(api_process)
        root.destroy.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
