#!/usr/bin/env python3
from __future__ import annotations

import json
from importlib import import_module
import os
import re
import shutil
import signal
import site
import subprocess
import sys
import tempfile
import threading
import time
from logging import Logger
from pathlib import Path
from typing import Any, Callable, cast
from urllib.parse import urlsplit, urlunsplit

_actions_common = next(
    (
        str(p / "_common")
        for p in Path(__file__).resolve().parents
        if p.name == "actions"
    ),
    None,
)
if _actions_common and _actions_common not in sys.path:
    sys.path.insert(0, _actions_common)


def _load_action_logger() -> Callable[[str], Logger]:
    module = import_module("action_logger")
    return cast(Callable[[str], Logger], getattr(module, "get_action_logger"))


get_action_logger = _load_action_logger()
_log = get_action_logger(__name__)

_env_utils = import_module("env_utils")
_parse_bool: Callable[..., bool] = getattr(_env_utils, "parse_bool")
_env_int: Callable[..., int] = getattr(_env_utils, "env_int")


NAMESPACE = "atlas-load"


def _env_str(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


def _is_cni_ip_assignment_failure(text: str) -> bool:
    hay = (text or "").lower()
    return (
        "failed to create pod sandbox" in hay
        and 'plugin type="aws-cni"' in hay
        and "failed to assign an ip address to container" in hay
    )


def _is_truthy(raw: str | None) -> bool:
    return _parse_bool(raw)


def _wait_timeout_seconds() -> int:
    return max(60, _env_int("WAIT_TIMEOUT_S", 2700))


def _require_env(name: str) -> str:
    value = _env_str(name)
    if not value:
        _log.error(f"Missing required env var: {name}")
        sys.exit(1)
    return value


def _run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd, check=check, text=True, capture_output=True, env=os.environ
    )


def _run_best_effort_timeout(cmd: list[str], *, timeout_s: float = 10.0) -> None:
    try:
        subprocess.run(
            cmd,
            check=False,
            text=True,
            capture_output=True,
            env=os.environ,
            timeout=timeout_s,
        )
    except subprocess.TimeoutExpired:
        _log.warning(
            "Cancellation cleanup command timed out after "
            f"{timeout_s:.0f}s: {' '.join(cmd)}"
        )
    except Exception as exc:
        _log.warning(
            "Cancellation cleanup command failed: "
            f"{' '.join(cmd)} error={type(exc).__name__}"
        )


def _is_aws_cli_usable(aws_cmd: str) -> bool:
    result = _run([aws_cmd, "--version"], check=False)
    return result.returncode == 0


def _append_file_from_cmd(
    log_file: Path, cmd: list[str], *, echo_to_stdout: bool = True
) -> None:
    try:
        result = _run(cmd, check=False)
    except Exception:
        return
    with log_file.open("a", encoding="utf-8") as fh:
        if result.stdout:
            for raw_line in result.stdout.splitlines(keepends=True):
                line = _optimize_debug_line(raw_line)
                if not line:
                    continue
                if echo_to_stdout:
                    sys.stdout.write(line)
                    sys.stdout.flush()
                fh.write(line)
        if result.stderr:
            filtered = "\n".join(
                line
                for line in result.stderr.splitlines()
                if "waiting to start: ContainerCreating" not in line
            )
            if filtered:
                if not filtered.endswith("\n"):
                    filtered += "\n"
                for raw_line in filtered.splitlines(keepends=True):
                    line = _optimize_debug_line(raw_line)
                    if not line:
                        continue
                    if echo_to_stdout:
                        sys.stdout.write(line)
                        sys.stdout.flush()
                    fh.write(line)


def _sanitize_debug_url(raw_url: str) -> str:
    value = str(raw_url or "").strip()
    if not value.startswith("http://") and not value.startswith("https://"):
        return value
    try:
        parts = urlsplit(value)
        if not parts.query:
            return value
        return urlunsplit((parts.scheme, parts.netloc, parts.path, "<redacted>", ""))
    except Exception:
        return value


_HTTPS_URL_RE = re.compile(r"https://[^\s\"]+")


def _optimize_debug_line(line: str) -> str:
    text = str(line or "")
    if not text:
        return text

    if "DEBUG/urllib3.connectionpool:" in text:
        text = _HTTPS_URL_RE.sub(lambda m: _sanitize_debug_url(m.group(0)), text)

    max_len = 900
    if len(text) > max_len:
        if text.endswith("\n"):
            return text[: max_len - 2] + "…\n"
        return text[: max_len - 1] + "…"
    return text


def _write_and_print(log_file: Path, text: str) -> None:
    if not text.endswith("\n"):
        text += "\n"
    _log.info(text.rstrip("\n"))
    with log_file.open("a", encoding="utf-8") as fh:
        fh.write(text)


def _put_cloudwatch_logs(log_file: Path, *, log_group_name: str, job_name: str) -> None:
    group = (log_group_name or "").strip()
    if not group:
        return

    if not log_file.exists():
        return

    stream_name = f"{job_name}/{int(time.time())}"

    create_stream = _run(
        [
            "aws",
            "logs",
            "create-log-stream",
            "--log-group-name",
            group,
            "--log-stream-name",
            stream_name,
        ],
        check=False,
    )
    if create_stream.returncode != 0 and "ResourceAlreadyExistsException" not in (
        (create_stream.stderr or "") + (create_stream.stdout or "")
    ):
        _log.warning(
            f"[cloudwatch] unable to create stream for group={group}: "
            f"{(create_stream.stderr or create_stream.stdout or '').strip()}"
        )
        return

    events: list[dict[str, object]] = []
    ts = int(time.time() * 1000)
    try:
        lines = log_file.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception:
        return

    for idx, line in enumerate(lines):
        message = line if line else " "
        events.append({"timestamp": ts + idx, "message": message})

    if not events:
        events = [{"timestamp": ts, "message": "(no log lines captured)"}]

    sequence_token = ""
    describe_stream = _run(
        [
            "aws",
            "logs",
            "describe-log-streams",
            "--log-group-name",
            group,
            "--log-stream-name-prefix",
            stream_name,
            "--query",
            "logStreams[0].uploadSequenceToken",
            "--output",
            "text",
        ],
        check=False,
    )
    if describe_stream.returncode == 0:
        token_value = (describe_stream.stdout or "").strip()
        if token_value and token_value != "None":
            sequence_token = token_value

    max_events = 10000
    max_bytes = 900000
    batch: list[dict[str, object]] = []
    batch_bytes = 0

    def flush_batch(current: list[dict[str, object]], token: str) -> str:
        if not current:
            return token

        payload_file = log_file.parent / ".cw-put-events.json"
        payload_file.write_text(
            json.dumps(current, ensure_ascii=False), encoding="utf-8"
        )

        cmd = [
            "aws",
            "logs",
            "put-log-events",
            "--log-group-name",
            group,
            "--log-stream-name",
            stream_name,
            "--log-events",
            f"file://{payload_file}",
        ]
        if token:
            cmd.extend(["--sequence-token", token])

        result = _run(cmd, check=False)
        if result.returncode != 0:
            _log.warning(
                f"[cloudwatch] failed to publish logs for job={job_name}: "
                f"{(result.stderr or result.stdout or '').strip()}"
            )
            return token

        next_token_res = _run(
            [
                "aws",
                "logs",
                "describe-log-streams",
                "--log-group-name",
                group,
                "--log-stream-name-prefix",
                stream_name,
                "--query",
                "logStreams[0].uploadSequenceToken",
                "--output",
                "text",
            ],
            check=False,
        )
        next_token = token
        if next_token_res.returncode == 0:
            tv = (next_token_res.stdout or "").strip()
            if tv and tv != "None":
                next_token = tv

        try:
            payload_file.unlink(missing_ok=True)
        except Exception:
            pass

        return next_token

    for event in events:
        msg = str(event["message"])
        size = len(msg.encode("utf-8")) + 26
        if batch and (len(batch) >= max_events or (batch_bytes + size) > max_bytes):
            sequence_token = flush_batch(batch, sequence_token)
            batch = []
            batch_bytes = 0

        batch.append(event)
        batch_bytes += size

    flush_batch(batch, sequence_token)
    _log.info(
        f"[cloudwatch] published kubectl logs for job={job_name} to group={group} stream={stream_name}\n"
    )


def _is_transient_helm_error(output: str) -> bool:
    hay = (output or "").lower()
    return (
        "failed calling webhook" in hay
        and "kyverno" in hay
        and "no endpoints available for service" in hay
    )


def _is_transient_kubectl_stream_error(line: str) -> bool:
    hay = (line or "").lower()
    transient_signals = [
        "http2: server sent goaway",
        "client connection lost",
        "use of closed network connection",
        "stream error",
    ]
    return any(signal in hay for signal in transient_signals)


def _job_not_found_error(result: subprocess.CompletedProcess[str]) -> bool:
    hay = f"{result.stdout or ''}\n{result.stderr or ''}".lower()
    return "error from server (notfound): jobs.batch" in hay and "not found" in hay


def _read_log_tail_text(log_file: Path, *, max_bytes: int = 1_000_000) -> str:
    try:
        with log_file.open("rb") as fh:
            fh.seek(0, os.SEEK_END)
            size = fh.tell()
            if size > max_bytes:
                fh.seek(-max_bytes, os.SEEK_END)
            else:
                fh.seek(0)
            data = fh.read()
        return data.decode("utf-8", errors="replace")
    except Exception:
        return ""


def _has_completion_signal_in_logs(log_file: Path) -> bool:
    text = _read_log_tail_text(log_file).lower()
    if not text:
        return False

    signals = [
        "aggregated",
        "upload_summary",
        "login_summary",
    ]
    return any(signal in text for signal in signals)


def _has_createupload_403_signal(log_file: Path) -> bool:
    text = _read_log_tail_text(log_file).lower()
    if not text:
        return False
    return (
        "createupload failed" in text and "status=403" in text
    ) or "setup_upload_forbidden" in text


def _has_delete_purge_signal(log_file: Path) -> bool:
    text = _read_log_tail_text(log_file).lower()
    if not text:
        return False
    return (
        "setup_overwrite_purge_start" in text
        or "setup_overwrite_purge_done" in text
        or "setup_overwrite_purge tenant=" in text
    )


def _has_auth_failure_signal(log_file: Path) -> bool:
    text = _read_log_tail_text(log_file).lower()
    if not text:
        return False
    signals = [
        "user login verification failed for",
        "login did not yield auth cookie",
        "auth_rejected_credentials",
        "auth_fail tenant=",
        "login_abort tenant=",
        "upload phase failed for",
        "unable to authenticate user for upload setup",
        "setup_auth_candidate_denied",
    ]
    return any(signal in text for signal in signals)


def _has_setup_forbidden_signal(log_file: Path) -> bool:
    text = _read_log_tail_text(log_file).lower()
    if not text:
        return False
    return (
        ("setup_skip_summary" in text and "reason=setup-upload-forbidden" in text)
        or ("getpresignedurl failed" in text and "status=403" in text)
        or ("directory.getpresignedurl" in text and "status=403" in text)
        or ("setup_auth_candidate_denied" in text and "detail=status=403" in text)
        or (
            "unable to authenticate user for upload setup" in text
            and "setup_auth_candidate_denied" in text
        )
    )


def _has_setup_auth_outage_signal(log_file: Path) -> bool:
    text = _read_log_tail_text(log_file).lower()
    if not text:
        return False
    return "setup_auth_outage" in text or (
        "setup_skip_summary" in text and "reason=setup-auth-outage" in text
    )


def _compact_pod_status_for_heartbeat(status_line: str) -> str:
    tokens = (status_line or "").split()
    if len(tokens) < 5:
        return status_line

    pod_name, phase, waiting, _ready, _restarts = tokens[:5]
    if waiting.lower() == "<none>":
        return f"{pod_name} {phase}"
    return f"{pod_name} {phase} {waiting}"


def _emit_recent_pod_logs_snapshot(
    log_file: Path, *, pod_name: str, job_name: str, max_lines: int = 25
) -> str:

    primary = _run(
        [
            "kubectl",
            "logs",
            "--namespace",
            NAMESPACE,
            pod_name,
            "-c",
            "atlas-load-generator",
            "--tail",
            str(max(1, int(max_lines))),
            "--timestamps=true",
        ],
        check=False,
    )
    text = ((primary.stdout or "") + "\n" + (primary.stderr or "")).strip()

    if not text:
        fallback = _run(
            [
                "kubectl",
                "logs",
                "--namespace",
                NAMESPACE,
                f"job/{job_name}",
                "--all-containers=true",
                "--tail",
                str(max(1, int(max_lines))),
                "--timestamps=true",
            ],
            check=False,
        )
        text = ((fallback.stdout or "") + "\n" + (fallback.stderr or "")).strip()

    if not text:
        return ""

    filtered = [
        line
        for line in text.splitlines()
        if line and "waiting to start: ContainerCreating" not in line
    ]
    if not filtered:
        return ""

    snapshot = "\n".join(filtered[-max(1, int(max_lines)) :]).strip()
    if not snapshot:
        return ""

    _write_and_print(
        log_file,
        f"[logs-tail] job={job_name} pod={pod_name} showing last {min(len(filtered), max_lines)} log line(s)",
    )
    _write_and_print(log_file, snapshot)
    return snapshot


def _extract_fixture_projects(args_json: str) -> list[str]:
    try:
        args = json.loads(args_json)
    except Exception:
        return []

    if not isinstance(args, list):
        return []

    parts = [str(item) for item in args]
    for idx, token in enumerate(parts):
        if token in {"-x", "--tenant-projects"}:
            if idx + 1 < len(parts):
                return [p.strip() for p in parts[idx + 1].split(",") if p.strip()]
        if token.startswith("-x="):
            return [p.strip() for p in token[3:].split(",") if p.strip()]
        if token.startswith("--tenant-projects="):
            return [p.strip() for p in token.split("=", 1)[1].split(",") if p.strip()]
    return []


def _read_tenant_name_from_fixture(project: str) -> str:
    tenants_path = Path("fixtures") / "tenants.json"
    try:
        registry = json.loads(tenants_path.read_text(encoding="utf-8"))
    except Exception:
        registry = {}
    if isinstance(registry, dict) and project in registry:
        data = registry[project]
        if isinstance(data, dict):
            return str(data.get("name") or "").strip()
    return ""


def _strip_numeric_zero_padding(name: str) -> str:
    def repl(match: re.Match[str]) -> str:
        prefix = match.group(1)
        digits = match.group(2)
        return f"{prefix}{int(digits)}"

    return re.sub(r"(^|[^0-9])(0+\d+)", repl, name)


def _emit_strict_fixture_mismatch_hint(
    log_file: Path, requested_projects: list[str]
) -> None:
    if not requested_projects:
        return

    try:
        content = log_file.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return

    mismatch = re.search(
        r"The tenant project '([^']+)' is not supported\. Found tenant projects:\s*([^\n\r]+)",
        content,
        flags=re.IGNORECASE,
    )
    if not mismatch:
        return

    unsupported = mismatch.group(1).strip()
    found_raw = mismatch.group(2).strip()
    found = [p.strip() for p in found_raw.split(",") if p.strip()]
    requested_set = {
        project.strip() for project in requested_projects if project.strip()
    }

    if unsupported not in requested_set:
        return

    tenant_name = _read_tenant_name_from_fixture(unsupported)
    if not tenant_name:
        return

    fallback_tenant_name = _strip_numeric_zero_padding(tenant_name)
    if fallback_tenant_name == tenant_name:
        return

    if not unsupported.endswith(f".{tenant_name}"):
        return

    fallback_project = unsupported[: -len(tenant_name)] + fallback_tenant_name
    if fallback_project not in found:
        return

    hint = (
        f"[preflight] strict tenant naming is enabled and this run requested tenant '{tenant_name}' "
        f"(tenant '{unsupported}'), but the runtime image exposes fallback tenant '{fallback_tenant_name}' "
        f"(tenant '{fallback_project}'). Rebuild and publish the ECR image used by this job "
        "(image.tag=latest) with tenant projects aligned to the tenant tenant.json name, then rerun."
    )
    _write_and_print(log_file, hint)


def _kyverno_webhook_ready() -> bool:
    svc_ready = _run(
        [
            "kubectl",
            "get",
            "endpoints",
            "--namespace",
            "kyverno",
            "kyverno-svc",
            "-o",
            "jsonpath={.subsets[*].addresses[*].ip}",
        ],
        check=False,
    )
    addresses = (svc_ready.stdout or "").strip()
    if not addresses:
        return False

    pod_ready = _run(
        [
            "kubectl",
            "get",
            "pods",
            "--namespace",
            "kyverno",
            "-l",
            "app.kubernetes.io/component=admission-controller",
            "-o",
            "jsonpath={.items[*].status.containerStatuses[*].ready}",
        ],
        check=False,
    )
    statuses = (pod_ready.stdout or "").strip().split()
    return bool(statuses) and all(s.lower() == "true" for s in statuses)


def _wait_for_kyverno_webhook(log_file: Path, *, timeout_seconds: int = 300) -> None:
    started = time.time()
    while time.time() - started < timeout_seconds:
        if _kyverno_webhook_ready():
            _write_and_print(log_file, "[helm] Kyverno webhook is ready")
            return
        _write_and_print(
            log_file,
            "[helm] waiting for Kyverno admission webhook readiness before Helm apply...",
        )
        time.sleep(10)

    _write_and_print(
        log_file,
        "[helm] Kyverno webhook still not ready after timeout; proceeding with Helm retry logic",
    )


def _run_helm_with_retry(log_file: Path, helm_cmd: list[str], *, job_name: str) -> None:
    max_attempts = 6
    sleep_seconds = 20

    for attempt in range(1, max_attempts + 1):
        _wait_for_kyverno_webhook(log_file)

        result = _run(helm_cmd, check=False)
        combined = ((result.stdout or "") + "\n" + (result.stderr or "")).strip()

        if result.returncode == 0:
            if combined:
                _write_and_print(log_file, combined)
            return

        if combined:
            _write_and_print(log_file, combined)

        if not _is_transient_helm_error(combined) or attempt >= max_attempts:
            raise subprocess.CalledProcessError(result.returncode, helm_cmd)

        _write_and_print(
            log_file,
            f"[helm] transient Kyverno webhook outage detected for job={job_name}; retry {attempt}/{max_attempts} in {sleep_seconds}s...",
        )

        _append_file_from_cmd(
            log_file,
            [
                "kubectl",
                "get",
                "pods",
                "--namespace",
                "kyverno",
                "-o",
                "wide",
            ],
        )
        _append_file_from_cmd(
            log_file,
            [
                "kubectl",
                "get",
                "endpoints",
                "--namespace",
                "kyverno",
                "kyverno-svc",
                "-o",
                "yaml",
            ],
        )

        time.sleep(sleep_seconds)


def _pin_kubeconfig_exec_aws_command(aws_path: str) -> None:
    kubeconfig_env = (os.environ.get("KUBECONFIG") or "").strip()
    kubeconfigs: list[Path] = []

    if kubeconfig_env:
        for raw_path in kubeconfig_env.split(os.pathsep):
            p = Path(raw_path.strip())
            if p and p.exists():
                kubeconfigs.append(p)
    else:
        default_kubeconfig = Path.home() / ".kube" / "config"
        if default_kubeconfig.exists():
            kubeconfigs.append(default_kubeconfig)

    for kubeconfig in kubeconfigs:
        try:
            content = kubeconfig.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        updated = re.sub(
            r"(?m)^(\s*command:\s*)(?:\"?[^\"\n]*aws\"?)\s*$",
            lambda match: f"{match.group(1)}{aws_path}",
            content,
        )
        if updated == content:
            continue

        try:
            kubeconfig.write_text(updated, encoding="utf-8")
        except Exception:
            continue

        sys.stderr.write(
            f"Pinned kubeconfig exec command to AWS CLI path: {aws_path} (file: {kubeconfig})\n"
        )


def _ensure_aws_in_path() -> str:
    candidates: list[str] = [
        "/usr/local/bin/aws",
        str(Path.home() / ".local/bin/aws"),
    ]

    try:
        user_base = site.getuserbase()
        candidates.append(str(Path(user_base) / "bin" / "aws"))
    except Exception:
        pass

    resolved = shutil.which("aws")
    if resolved:
        candidates.append(resolved)

    candidates.extend(
        [
            "/usr/bin/aws",
            "/bin/aws",
        ]
    )

    seen: set[str] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        if (
            os.path.exists(candidate)
            and os.access(candidate, os.X_OK)
            and _is_aws_cli_usable(candidate)
        ):
            bin_dir = os.path.dirname(candidate)
            sys.stderr.write(f"Using aws executable: {candidate}\n")
            os.environ["PATH"] = f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}"
            _pin_kubeconfig_exec_aws_command(candidate)
            return candidate

    sys.stderr.write(
        "WARNING: 'aws' executable not found in PATH or common locations.\\n"
    )
    sys.stderr.write(f"Current PATH: {os.environ.get('PATH', '')}\\n")
    raise RuntimeError("Unable to find a runnable 'aws' executable for EKS auth plugin")


def _matches_any_filter(name: str, raw_filters: str) -> bool:
    filters = [f.strip() for f in str(raw_filters or "").split(",") if f.strip()]
    if not filters:
        return True
    return any(f in name for f in filters)


def _maybe_scale_nodegroups(
    *, aws_cmd: str, cluster_name: str, aws_region: str
) -> None:
    filters = _env_str("EKS_AUTOSCALE_NODEGROUP_FILTERS")
    step = max(1, _env_int("EKS_AUTOSCALE_STEP", 1))
    max_desired = max(1, _env_int("EKS_AUTOSCALE_MAX_DESIRED", 20))

    _log.info(
        "EKS autoscale: scanning managed nodegroups for "
        f"cluster={cluster_name} (step={step}, max_desired={max_desired}, filters='{filters}')"
    )

    listed = _run(
        [
            aws_cmd,
            "eks",
            "list-nodegroups",
            "--cluster-name",
            cluster_name,
            "--region",
            aws_region,
            "--query",
            "nodegroups[]",
            "--output",
            "text",
        ],
        check=False,
    )
    nodegroups_raw = (listed.stdout or "").strip()
    if listed.returncode != 0 or not nodegroups_raw or nodegroups_raw == "None":
        _log.info(
            "EKS autoscale: no managed nodegroups found (or no permissions); skipping"
        )
        return

    scaled_any = False
    for ng in nodegroups_raw.split():
        if not _matches_any_filter(ng, filters):
            continue

        desc = _run(
            [
                aws_cmd,
                "eks",
                "describe-nodegroup",
                "--cluster-name",
                cluster_name,
                "--nodegroup-name",
                ng,
                "--region",
                aws_region,
                "--query",
                "nodegroup.[status,scalingConfig.desiredSize,scalingConfig.minSize,scalingConfig.maxSize]",
                "--output",
                "text",
            ],
            check=False,
        )
        fields = (desc.stdout or "").strip().split()
        status = fields[0] if len(fields) > 0 else ""
        desired = int(fields[1]) if len(fields) > 1 and fields[1].isdigit() else 0
        min_size = int(fields[2]) if len(fields) > 2 and fields[2].isdigit() else 0
        max_size = int(fields[3]) if len(fields) > 3 and fields[3].isdigit() else 0

        if status != "ACTIVE":
            _log.info(f"EKS autoscale: skipping nodegroup={ng} status={status}")
            continue

        target_desired = min(max_desired, desired + step)
        target_max = max(max_size, target_desired)
        target_min = min(min_size, target_desired)

        if (
            target_desired == desired
            and target_max == max_size
            and target_min == min_size
        ):
            _log.info(
                "EKS autoscale: nodegroup="
                f"{ng} already at/above target (desired={desired}, min={min_size}, max={max_size})"
            )
            continue

        _log.info(
            "EKS autoscale: updating nodegroup="
            f"{ng} desired {desired}->{target_desired}, min {min_size}->{target_min}, max {max_size}->{target_max}"
        )
        updated = _run(
            [
                aws_cmd,
                "eks",
                "update-nodegroup-config",
                "--cluster-name",
                cluster_name,
                "--nodegroup-name",
                ng,
                "--region",
                aws_region,
                "--scaling-config",
                f"minSize={target_min},maxSize={target_max},desiredSize={target_desired}",
            ],
            check=False,
        )
        if updated.returncode != 0:
            out = ((updated.stdout or "") + "\n" + (updated.stderr or "")).lower()
            if (
                "resourceinuseexception" in out
                or "currently not in active state" in out
            ):
                _log.info(
                    f"EKS autoscale: nodegroup={ng} is currently updating; skipping scale change this run"
                )
                continue
            raise RuntimeError(
                "EKS autoscale: failed updating nodegroup="
                f"{ng}: {(updated.stderr or updated.stdout or '').strip()}"
            )
        scaled_any = True

    if scaled_any:
        _log.info("EKS autoscale: submitted nodegroup scaling updates.")
    else:
        _log.info("EKS autoscale: no matching nodegroups required scaling updates.")


def _refresh_kubeconfig_and_validate(
    *, aws_cmd: str, cluster_name: str, aws_region: str
) -> None:
    tmp_root = (os.environ.get("RUNNER_TEMP") or "/tmp").strip() or "/tmp"
    os.makedirs(tmp_root, exist_ok=True)
    fd, kubeconfig_path = tempfile.mkstemp(
        prefix=f"kubeconfig.{cluster_name}.", dir=tmp_root
    )
    os.close(fd)
    os.chmod(kubeconfig_path, 0o600)
    os.environ["KUBECONFIG"] = kubeconfig_path

    _log.info(f"Refreshing kubeconfig for cluster={cluster_name} region={aws_region}")
    token = _run(
        [
            aws_cmd,
            "eks",
            "get-token",
            "--cluster-name",
            cluster_name,
            "--region",
            aws_region,
        ],
        check=False,
    )
    if token.returncode != 0:
        raise RuntimeError(
            "aws eks get-token failed: "
            f"{(token.stderr or token.stdout or '').strip()}"
        )

    updated = _run(
        [
            aws_cmd,
            "eks",
            "update-kubeconfig",
            "--name",
            cluster_name,
            "--region",
            aws_region,
            "--kubeconfig",
            kubeconfig_path,
        ],
        check=False,
    )
    if updated.returncode != 0:
        raise RuntimeError(
            "aws eks update-kubeconfig failed: "
            f"{(updated.stderr or updated.stdout or '').strip()}"
        )

    _log.info("Validating Kubernetes API auth...")
    can_i = _run(
        ["kubectl", "auth", "can-i", "get", "pods", "-n", NAMESPACE], check=False
    )
    if can_i.returncode == 0 and "yes" in (can_i.stdout or "").strip().lower():
        return

    caller = _run(
        [aws_cmd, "sts", "get-caller-identity", "--query", "Arn", "--output", "text"],
        check=False,
    )
    caller_arn = (caller.stdout or "").strip()
    principal_for_access_entry = caller_arn
    m = re.match(r"^arn:aws:sts::([0-9]+):assumed-role/([^/]+)/.*$", caller_arn)
    if m:
        principal_for_access_entry = f"arn:aws:iam::{m.group(1)}:role/{m.group(2)}"

    raise RuntimeError(
        "Kubernetes API auth failed for IAM principal: "
        f"{caller_arn}\n"
        "This EC2 instance role needs EKS cluster access (Access Entry or aws-auth mapping).\n"
        "Example (run once by cluster admin):\n"
        f"  aws eks create-access-entry --cluster-name '{cluster_name}' --principal-arn '{principal_for_access_entry}' --type STANDARD\n"
        "  aws eks associate-access-policy "
        f"--cluster-name '{cluster_name}' --principal-arn '{principal_for_access_entry}' "
        "--policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy --access-scope type=cluster"
    )


def main() -> None:
    aws_cmd = _ensure_aws_in_path()
    cluster_name = _env_str("EKS_CLUSTER_NAME")
    aws_region = _env_str("EKS_AWS_REGION")
    if cluster_name and aws_region:
        if _is_truthy(os.environ.get("ENABLE_EKS_AUTOSCALE")):
            _maybe_scale_nodegroups(
                aws_cmd=aws_cmd,
                cluster_name=cluster_name,
                aws_region=aws_region,
            )
        _refresh_kubeconfig_and_validate(
            aws_cmd=aws_cmd,
            cluster_name=cluster_name,
            aws_region=aws_region,
        )

    job_name = _require_env("JOB_NAME")
    args_json = _require_env("ARGS_JSON")
    requested_fixture_projects = _extract_fixture_projects(args_json)
    ecr_repo_uri = _require_env("ECR_REPO_URI")
    image_tag = _env_str("IMAGE_TAG", "latest")
    s3_bucket_name = _require_env("S3_BUCKET_NAME")
    irsa_role_arn = _require_env("IRSA_ROLE_ARN")
    log_group_name = _env_str("LOG_GROUP_NAME")
    upload_udrs_s3_real_file = _env_str("UPLOAD_UDRS_S3_REAL_FILE")
    upload_udrs_s3_bucket = _env_str("UPLOAD_UDRS_S3_BUCKET")
    upload_complete_timeout_s = _env_str("UPLOAD_COMPLETE_TIMEOUT_S")
    delete_existing_evidences = _env_str("CLBT_DELETE_EXISTING_EVIDENCES")
    directory_enable_upload_header_variants = _env_str(
        "CLBT_DIRECTORY_ENABLE_UPLOAD_HEADER_VARIANTS"
    )
    directory_enable_system_upload_fallback = _env_str(
        "CLBT_DIRECTORY_ENABLE_SYSTEM_UPLOAD_FALLBACK"
    )
    directory_enable_initiator_strip_retry = _env_str(
        "CLBT_DIRECTORY_ENABLE_INITIATOR_STRIP_RETRY"
    )
    setup_force_token_refresh_after_operator = _env_str(
        "CLBT_SETUP_FORCE_TOKEN_REFRESH_AFTER_OPERATOR"
    )
    setup_force_token_refresh_after_operator_strict = _env_str(
        "CLBT_SETUP_FORCE_TOKEN_REFRESH_AFTER_OPERATOR_STRICT"
    )
    setup_upload_part_size_bytes = _env_str("CLBT_SETUP_UPLOAD_PART_SIZE_BYTES")
    setup_upload_parallel_files = _env_str("CLBT_SETUP_UPLOAD_PARALLEL_FILES")
    log_level = _env_str("CLBT_LOG_LEVEL")
    delete_requested = _is_truthy(delete_existing_evidences)
    resources_requests_cpu = _env_str("RESOURCES_REQUESTS_CPU")
    resources_requests_memory = _env_str("RESOURCES_REQUESTS_MEMORY")
    resources_limits_cpu = _env_str("RESOURCES_LIMITS_CPU")
    resources_limits_memory = _env_str("RESOURCES_LIMITS_MEMORY")
    fail_fast_on_cni_ip_failure = _is_truthy(
        os.environ.get("FAIL_FAST_ON_CNI_IP_FAILURE")
    )
    fail_open_create_upload_403 = _is_truthy(
        os.environ.get("FAIL_OPEN_CREATE_UPLOAD_403")
    )
    extra_env_json = _env_str("EXTRA_ENV_JSON", "[]")
    result_dir = Path(_require_env("RESULT_DIR"))
    github_output = _require_env("GITHUB_OUTPUT")

    result_dir.mkdir(parents=True, exist_ok=True)
    log_file = result_dir / "cloudwatch-logs.log"
    describe_file = result_dir / "k8s-job.describe.log"
    log_file.touch(exist_ok=True)

    def _cleanup_on_cancel(signal_name: str) -> None:
        _write_and_print(
            log_file,
            f"Cancellation detected ({signal_name}); stopping EKS load job...",
        )
        _run_best_effort_timeout(
            [
                "kubectl",
                "delete",
                "job",
                "--namespace",
                NAMESPACE,
                job_name,
                "--ignore-not-found=true",
            ],
            timeout_s=8.0,
        )
        _run_best_effort_timeout(
            ["helm", "uninstall", job_name, "--namespace", NAMESPACE],
            timeout_s=8.0,
        )

    def _handle_cancel(signum: int, _frame: Any) -> None:
        sig_name = signal.Signals(signum).name
        _cleanup_on_cancel(sig_name)
        raise SystemExit(143)

    signal.signal(signal.SIGTERM, _handle_cancel)
    signal.signal(signal.SIGINT, _handle_cancel)

    helm_cmd = [
        "helm",
        "upgrade",
        "--install",
        job_name,
        "ci/eks/helm/atlas-load",
        "--namespace",
        NAMESPACE,
        "--create-namespace",
        "-f",
        "ci/eks/helm/atlas-load/values.yaml",
        "--set",
        f"job.name={job_name}",
        "--set",
        f"serviceAccount.name={job_name}",
        "--set",
        f"image.repository={ecr_repo_uri}",
        "--set",
        f"image.tag={image_tag}",
        "--set",
        "image.pullPolicy=Always",
        "--set",
        f"env.s3BucketName={s3_bucket_name}",
        "--set",
        f"serviceAccount.roleArn={irsa_role_arn}",
        "--set-json",
        f"args={args_json}",
    ]
    try:
        extra_envs = json.loads(extra_env_json)
    except json.JSONDecodeError:
        extra_envs = []
    if extra_envs:
        helm_cmd.extend(["--set-json", f"env.extraEnvs={json.dumps(extra_envs)}"])
    if upload_udrs_s3_real_file:
        helm_cmd.extend(
            [
                "--set",
                f"env.uploadUdrsS3RealFile={upload_udrs_s3_real_file}",
            ]
        )
    if upload_udrs_s3_bucket:
        helm_cmd.extend(
            [
                "--set",
                f"env.uploadUdrsS3Bucket={upload_udrs_s3_bucket}",
            ]
        )
    if upload_complete_timeout_s:
        helm_cmd.extend(
            [
                "--set",
                f"env.uploadCompleteTimeoutS={upload_complete_timeout_s}",
            ]
        )
    if delete_existing_evidences:
        _log.info(
            "Forwarding delete-existing flag to pod env: "
            f"CLBT_DELETE_EXISTING_EVIDENCES={delete_existing_evidences}"
        )
        helm_cmd.extend(
            [
                "--set",
                f"env.deleteExistingEvidences={delete_existing_evidences}",
            ]
        )
    if directory_enable_upload_header_variants:
        helm_cmd.extend(
            [
                "--set",
                "env.directoryEnableUploadHeaderVariants="
                f"{directory_enable_upload_header_variants}",
            ]
        )
    if directory_enable_system_upload_fallback:
        helm_cmd.extend(
            [
                "--set",
                "env.directoryEnableSystemUploadFallback="
                f"{directory_enable_system_upload_fallback}",
            ]
        )
    if directory_enable_initiator_strip_retry:
        helm_cmd.extend(
            [
                "--set",
                "env.directoryEnableInitiatorStripRetry="
                f"{directory_enable_initiator_strip_retry}",
            ]
        )
    if setup_force_token_refresh_after_operator:
        helm_cmd.extend(
            [
                "--set",
                "env.setupForceTokenRefreshAfterOperator="
                f"{setup_force_token_refresh_after_operator}",
            ]
        )
    if setup_force_token_refresh_after_operator_strict:
        helm_cmd.extend(
            [
                "--set",
                "env.setupForceTokenRefreshAfterOperatorStrict="
                f"{setup_force_token_refresh_after_operator_strict}",
            ]
        )
    if setup_upload_part_size_bytes:
        helm_cmd.extend(
            [
                "--set",
                f"env.setupUploadPartSizeBytes={setup_upload_part_size_bytes}",
            ]
        )
    if setup_upload_parallel_files:
        helm_cmd.extend(
            [
                "--set",
                f"env.setupUploadParallelFiles={setup_upload_parallel_files}",
            ]
        )
    if log_level:
        helm_cmd.extend(
            [
                "--set",
                f"env.logLevel={log_level}",
            ]
        )
    if resources_requests_cpu:
        helm_cmd.extend(
            [
                "--set",
                f"resources.requests.cpu={resources_requests_cpu}",
            ]
        )
    if resources_requests_memory:
        helm_cmd.extend(
            [
                "--set",
                f"resources.requests.memory={resources_requests_memory}",
            ]
        )
    if resources_limits_cpu:
        helm_cmd.extend(
            [
                "--set",
                f"resources.limits.cpu={resources_limits_cpu}",
            ]
        )
    if resources_limits_memory:
        helm_cmd.extend(
            [
                "--set",
                f"resources.limits.memory={resources_limits_memory}",
            ]
        )
    _run_helm_with_retry(log_file, helm_cmd, job_name=job_name)

    stream_proc: subprocess.Popen[str] | None = None
    streamed_line_count = 0
    stop_event = threading.Event()
    status_started_at = time.time()
    cni_ip_issue: dict[str, str | bool] = {
        "detected": False,
        "pod_name": "",
        "details": "",
    }

    def emit_container_creating_diagnostics(pod_name: str) -> None:
        _write_and_print(
            log_file,
            f"[diag] job={job_name} pod={pod_name} still ContainerCreating; collecting diagnostics...",
        )

        pod_desc = _run(
            ["kubectl", "describe", "pod", "--namespace", NAMESPACE, pod_name],
            check=False,
        )
        desc_text = ((pod_desc.stdout or "") + (pod_desc.stderr or "")).strip()
        if desc_text:
            _write_and_print(log_file, "[diag] kubectl describe pod (tail 80 lines):")
            desc_tail = "\n".join(desc_text.splitlines()[-80:])
            _write_and_print(log_file, desc_tail)

        events = _run(
            [
                "kubectl",
                "get",
                "events",
                "--namespace",
                NAMESPACE,
                "--field-selector",
                f"involvedObject.name={pod_name}",
                "--sort-by=.lastTimestamp",
            ],
            check=False,
        )
        events_text = ((events.stdout or "") + (events.stderr or "")).strip()
        if events_text:
            _write_and_print(log_file, "[diag] kubectl events for pod (tail 40 lines):")
            events_tail = "\n".join(events_text.splitlines()[-40:])
            _write_and_print(log_file, events_tail)

        combined = "\n".join([desc_text, events_text]).strip()
        if combined and _is_cni_ip_assignment_failure(combined):
            cni_ip_issue["detected"] = True
            cni_ip_issue["pod_name"] = pod_name
            cni_ip_issue["details"] = (
                "Detected aws-cni IP allocation failure while creating pod sandbox "
                f"for pod={pod_name}. Likely VPC CNI/IP capacity pressure on cluster nodes."
            )
            _write_and_print(log_file, f"[diag] {cni_ip_issue['details']}")

    def emit_failed_pod_diagnostics(pod_name: str) -> None:
        _write_and_print(
            log_file,
            f"[diag] job={job_name} pod={pod_name} entered Failed; collecting failure diagnostics...",
        )

        term = _run(
            [
                "kubectl",
                "get",
                "pod",
                "--namespace",
                NAMESPACE,
                pod_name,
                "-o",
                "jsonpath={.status.containerStatuses[0].state.terminated.reason}|{.status.containerStatuses[0].state.terminated.exitCode}|{.status.containerStatuses[0].state.terminated.message}",
            ],
            check=False,
        )
        term_text = (term.stdout or "").strip()
        if term_text and term_text != "||":
            _write_and_print(log_file, f"[diag] terminated: {term_text}")

        waiting = _run(
            [
                "kubectl",
                "get",
                "pod",
                "--namespace",
                NAMESPACE,
                pod_name,
                "-o",
                "jsonpath={.status.containerStatuses[0].state.waiting.reason}|{.status.containerStatuses[0].state.waiting.message}",
            ],
            check=False,
        )
        waiting_text = (waiting.stdout or "").strip()
        if waiting_text and waiting_text != "|":
            _write_and_print(log_file, f"[diag] waiting: {waiting_text}")

        pod_status = _run(
            [
                "kubectl",
                "get",
                "pod",
                "--namespace",
                NAMESPACE,
                pod_name,
                "-o",
                "jsonpath={.status.reason}|{.status.message}",
            ],
            check=False,
        )
        pod_status_text = (pod_status.stdout or "").strip()
        if pod_status_text and pod_status_text != "|":
            _write_and_print(log_file, f"[diag] pod status: {pod_status_text}")

        pod_events = _run(
            [
                "kubectl",
                "get",
                "events",
                "--namespace",
                NAMESPACE,
                "--field-selector",
                f"involvedObject.name={pod_name}",
                "--sort-by=.lastTimestamp",
                "-o",
                "custom-columns=TIME:.lastTimestamp,TYPE:.type,REASON:.reason,MESSAGE:.message",
            ],
            check=False,
        )
        events_text = ((pod_events.stdout or "") + (pod_events.stderr or "")).strip()
        if events_text:
            _write_and_print(
                log_file,
                f"[diag] pod events:\n{chr(10).join(events_text.splitlines()[-30:])}",
            )

        pod_desc = _run(
            [
                "kubectl",
                "get",
                "pod",
                "--namespace",
                NAMESPACE,
                pod_name,
                "-o",
                "jsonpath={.status.containerStatuses[0].lastState.terminated.reason}|{.status.containerStatuses[0].lastState.terminated.exitCode}",
            ],
            check=False,
        )
        last_state_text = (pod_desc.stdout or "").strip()
        if last_state_text and last_state_text != "|":
            _write_and_print(
                log_file, f"[diag] lastState terminated: {last_state_text}"
            )

    def emit_pending_capacity_diagnostics(pod_name: str) -> None:
        _write_and_print(
            log_file,
            f"[diag] job={job_name} pod={pod_name} stayed Pending for >2m; collecting capacity/scheduling diagnostics...",
        )

        pod_desc = _run(
            ["kubectl", "describe", "pod", "--namespace", NAMESPACE, pod_name],
            check=False,
        )
        pod_desc_text = ((pod_desc.stdout or "") + (pod_desc.stderr or "")).strip()
        if pod_desc_text:
            _write_and_print(
                log_file,
                "[diag] pending pod describe (tail 120 lines):",
            )
            _write_and_print(log_file, "\n".join(pod_desc_text.splitlines()[-120:]))

        rq = _run(
            ["kubectl", "get", "resourcequota", "--namespace", NAMESPACE, "-o", "yaml"],
            check=False,
        )
        rq_text = ((rq.stdout or "") + (rq.stderr or "")).strip()
        if rq_text:
            _write_and_print(log_file, "[diag] namespace resourcequota:")
            _write_and_print(log_file, "\n".join(rq_text.splitlines()[-120:]))

        limits = _run(
            ["kubectl", "get", "limitrange", "--namespace", NAMESPACE, "-o", "yaml"],
            check=False,
        )
        limits_text = ((limits.stdout or "") + (limits.stderr or "")).strip()
        if limits_text:
            _write_and_print(log_file, "[diag] namespace limitrange:")
            _write_and_print(log_file, "\n".join(limits_text.splitlines()[-120:]))

        node_summary = _run(
            [
                "kubectl",
                "get",
                "nodes",
                "-o",
                "custom-columns=NAME:.metadata.name,READY:.status.conditions[-1].status,CPU:.status.allocatable.cpu,MEM:.status.allocatable.memory,PODS:.status.allocatable.pods",
                "--no-headers",
            ],
            check=False,
        )
        node_summary_text = (
            (node_summary.stdout or "") + (node_summary.stderr or "")
        ).strip()
        if node_summary_text:
            _write_and_print(log_file, "[diag] node allocatable summary:")
            _write_and_print(log_file, node_summary_text)

        all_events = _run(
            [
                "kubectl",
                "get",
                "events",
                "--namespace",
                NAMESPACE,
                "--sort-by=.lastTimestamp",
            ],
            check=False,
        )
        all_events_text = (
            (all_events.stdout or "") + (all_events.stderr or "")
        ).strip()
        if all_events_text:
            _write_and_print(log_file, "[diag] namespace events (tail 80 lines):")
            _write_and_print(log_file, "\n".join(all_events_text.splitlines()[-80:]))

    def emit_pod_status() -> None:
        nonlocal streamed_line_count
        container_creating_cycles = 0
        last_diag_cycle = 0
        pending_cycles = 0
        last_pending_diag_cycle = 0
        failure_diagnostics_emitted_for: set[str] = set()
        last_status_line = ""
        last_status_heartbeat = 0.0
        last_streamed_line_count = 0
        last_logs_snapshot = ""
        while not stop_event.is_set():
            status_res = _run(
                [
                    "kubectl",
                    "get",
                    "pods",
                    "--namespace",
                    NAMESPACE,
                    "-l",
                    f"job-name={job_name}",
                    "-o",
                    "custom-columns=NAME:.metadata.name,PHASE:.status.phase,WAITING:.status.containerStatuses[0].state.waiting.reason,READY:.status.containerStatuses[0].ready,RESTARTS:.status.containerStatuses[0].restartCount",
                    "--no-headers",
                ],
                check=False,
            )
            status_line = (status_res.stdout or "").strip() or "no pod yet"
            if status_line != last_status_line:
                _write_and_print(log_file, f"[status] job={job_name} {status_line}")
                last_status_line = status_line
                last_status_heartbeat = time.time()
            elif (time.time() - last_status_heartbeat) >= 60:
                heartbeat_status = _compact_pod_status_for_heartbeat(status_line)
                elapsed_s = int(max(0, time.time() - status_started_at))
                stream_delta = max(
                    0, int(streamed_line_count) - last_streamed_line_count
                )
                last_streamed_line_count = int(streamed_line_count)
                _write_and_print(
                    log_file,
                    f"[status] job={job_name} still {heartbeat_status} (heartbeat, elapsed={elapsed_s}s, stream_lines={streamed_line_count}, +{stream_delta})",
                )
                pod_name = (
                    status_line.split()[0]
                    if status_line and status_line != "no pod yet"
                    else ""
                )
                if pod_name:
                    try:
                        snapshot = _emit_recent_pod_logs_snapshot(
                            log_file,
                            pod_name=pod_name,
                            job_name=job_name,
                            max_lines=25,
                        )
                    except Exception as exc:
                        _write_and_print(
                            log_file,
                            f"[logs-tail] job={job_name} pod={pod_name} snapshot failed: {type(exc).__name__}",
                        )
                        snapshot = ""

                    if snapshot:
                        if snapshot == last_logs_snapshot:
                            _write_and_print(
                                log_file,
                                f"[logs-tail] job={job_name} pod={pod_name} no new log lines since last heartbeat",
                            )
                        last_logs_snapshot = snapshot
                last_status_heartbeat = time.time()

            if " Failed " in f" {status_line} ":
                pod_name = (
                    status_line.split()[0]
                    if status_line and status_line != "no pod yet"
                    else ""
                )
                if pod_name and pod_name not in failure_diagnostics_emitted_for:
                    emit_failed_pod_diagnostics(pod_name)
                    failure_diagnostics_emitted_for.add(pod_name)

            if "ContainerCreating" in status_line:
                container_creating_cycles += 1
                should_emit_diag = container_creating_cycles >= 2 and (
                    last_diag_cycle == 0
                    or (container_creating_cycles - last_diag_cycle) >= 4
                )
                if should_emit_diag:
                    pod_name = (
                        status_line.split()[0]
                        if status_line and status_line != "no pod yet"
                        else ""
                    )
                    if pod_name:
                        emit_container_creating_diagnostics(pod_name)
                        last_diag_cycle = container_creating_cycles
            else:
                container_creating_cycles = 0
                last_diag_cycle = 0

            is_pending = " Pending " in f" {status_line} "
            if is_pending:
                pending_cycles += 1
                should_emit_pending_diag = pending_cycles >= 8 and (
                    last_pending_diag_cycle == 0
                    or (pending_cycles - last_pending_diag_cycle) >= 8
                )
                if should_emit_pending_diag:
                    pod_name = (
                        status_line.split()[0]
                        if status_line and status_line != "no pod yet"
                        else ""
                    )
                    if pod_name:
                        emit_pending_capacity_diagnostics(pod_name)
                        last_pending_diag_cycle = pending_cycles
            else:
                pending_cycles = 0
                last_pending_diag_cycle = 0

            time.sleep(15)

    def stream_logs() -> None:
        nonlocal streamed_line_count
        nonlocal stream_proc
        sys.stdout.write(f"Waiting for job pod and streaming logs: {job_name}\n")
        sys.stdout.flush()
        pod_name = ""
        for attempt in range(180):
            if stop_event.is_set():
                return
            res = _run(
                [
                    "kubectl",
                    "get",
                    "pods",
                    "--namespace",
                    NAMESPACE,
                    "-l",
                    f"job-name={job_name}",
                    "-o",
                    "jsonpath={.items[0].metadata.name}",
                ],
                check=False,
            )
            pod_name = (res.stdout or "").strip()
            if pod_name:
                break

            if attempt > 0 and attempt % 12 == 0:
                msg = (
                    f"[logs] job={job_name} waiting for pod object... "
                    f"elapsed~{attempt * 5}s\n"
                )
                sys.stdout.write(msg)
                sys.stdout.flush()
                with log_file.open("a", encoding="utf-8") as fh:
                    fh.write(msg)

            time.sleep(5)

        if not pod_name:
            msg = f"Pod for job {job_name} was not found in time\n"
            sys.stdout.write(msg)
            sys.stdout.flush()
            with log_file.open("a", encoding="utf-8") as fh:
                fh.write(msg)
            return

        _write_and_print(
            log_file,
            f"[logs] job={job_name} pod={pod_name} detected; attaching log stream",
        )

        STREAM_IDLE_TIMEOUT_S = 45

        primary_logs_cmd = [
            "kubectl",
            "logs",
            "--namespace",
            NAMESPACE,
            "-f",
            pod_name,
            "-c",
            "atlas-load-generator",
            "--prefix=true",
            "--pod-running-timeout=45m",
        ]
        fallback_logs_cmd = [
            "kubectl",
            "logs",
            "--namespace",
            NAMESPACE,
            "-f",
            f"job/{job_name}",
            "--all-containers=true",
            "--prefix=true",
            "--pod-running-timeout=45m",
        ]

        def _readline_with_idle_timeout(
            proc: subprocess.Popen[str],
            timeout_s: float,
        ) -> str | None:
            import selectors

            sel = selectors.DefaultSelector()
            try:
                assert proc.stdout is not None
                sel.register(proc.stdout, selectors.EVENT_READ)
                events = sel.select(timeout=timeout_s)
                if not events:
                    return None
                return proc.stdout.readline()
            except (ValueError, OSError):
                return None
            finally:
                sel.close()

        with log_file.open("a", encoding="utf-8") as fh:
            while not stop_event.is_set():
                stream_rc: int | None = None
                saw_transient = False
                streamed_any_line = False
                for cmd_name, logs_cmd in (
                    ("primary", primary_logs_cmd),
                    ("fallback", fallback_logs_cmd),
                ):
                    _write_and_print(
                        log_file,
                        f"[logs] job={job_name} starting {cmd_name} log stream: {' '.join(logs_cmd)}",
                    )
                    stream_proc = subprocess.Popen(
                        logs_cmd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        bufsize=1,
                    )

                    assert stream_proc.stdout is not None
                    idle_since = time.time()
                    while True:
                        if stop_event.is_set():
                            break
                        line = _readline_with_idle_timeout(
                            stream_proc,
                            timeout_s=min(5.0, STREAM_IDLE_TIMEOUT_S),
                        )
                        if line is None or line == "":
                            if stream_proc.poll() is not None:
                                break
                            if (time.time() - idle_since) >= STREAM_IDLE_TIMEOUT_S:
                                _write_and_print(
                                    log_file,
                                    f"[logs] job={job_name} {cmd_name} stream produced no output for {STREAM_IDLE_TIMEOUT_S}s; killing stalled process",
                                )
                                try:
                                    stream_proc.kill()
                                    stream_proc.wait(timeout=5)
                                except Exception:
                                    pass
                                break
                            continue
                        idle_since = time.time()
                        if "waiting to start: ContainerCreating" in line:
                            saw_transient = True
                            continue
                        if (
                            "Error from server (BadRequest):" in line
                            and "ContainerCreating" in line
                        ):
                            saw_transient = True
                            continue
                        if _is_transient_kubectl_stream_error(line):
                            saw_transient = True
                            continue
                        safe_line = _optimize_debug_line(line)
                        if not safe_line:
                            continue
                        streamed_any_line = True
                        streamed_line_count += 1
                        sys.stdout.write(safe_line)
                        sys.stdout.flush()
                        fh.write(safe_line)

                    if stop_event.is_set():
                        break

                    stream_rc = stream_proc.wait()
                    if stream_rc == 0:
                        break

                    msg = (
                        f"[logs] job={job_name} {cmd_name} stream exited rc={stream_rc}; "
                        "retrying with alternate log source if available...\n"
                    )
                    sys.stdout.write(msg)
                    sys.stdout.flush()
                    fh.write(msg)

                if stop_event.is_set():
                    try:
                        if stream_proc and stream_proc.poll() is None:
                            stream_proc.terminate()
                    except Exception:
                        pass
                    break

                if stream_rc == 0:
                    break

                if saw_transient:
                    msg = (
                        f"[logs] job={job_name} stream interrupted by a transient "
                        "Kubernetes connection event; retrying log stream...\n"
                    )
                    sys.stdout.write(msg)
                    sys.stdout.flush()
                    fh.write(msg)
                elif not streamed_any_line:
                    _append_file_from_cmd(
                        log_file,
                        [
                            "kubectl",
                            "describe",
                            "pod",
                            "--namespace",
                            NAMESPACE,
                            pod_name,
                        ],
                        echo_to_stdout=True,
                    )
                time.sleep(3)

    stream_thread = threading.Thread(target=stream_logs, daemon=True)
    status_thread = threading.Thread(target=emit_pod_status, daemon=True)
    status_thread.start()
    stream_thread.start()

    exit_code = "0"
    deadline = time.time() + _wait_timeout_seconds()
    failed_without_terminal_since: float | None = None
    while time.time() < deadline:
        if fail_open_create_upload_403 and _has_createupload_403_signal(log_file):
            if (
                delete_requested
                and not _has_delete_purge_signal(log_file)
                and not _has_auth_failure_signal(log_file)
                and not _has_setup_forbidden_signal(log_file)
                and not _has_setup_auth_outage_signal(log_file)
            ):
                _write_and_print(
                    log_file,
                    "[wait] delete-before-upload was requested but no purge marker was found in pod logs; treating setup run as failure",
                )
                exit_code = "1"
                break
            _write_and_print(
                log_file,
                "[wait] fail-open enabled: detected createUpload failed (status=403) in pod logs; ending setup run early as success",
            )
            exit_code = "0"
            break

        if fail_fast_on_cni_ip_failure and cni_ip_issue.get("detected"):
            _write_and_print(
                log_file,
                f"[wait] terminating early due to infrastructure networking failure for job={job_name} "
                f"(pod={cni_ip_issue.get('pod_name')}).",
            )
            exit_code = "1"
            break

        job_state = _run(
            [
                "kubectl",
                "get",
                "job",
                "--namespace",
                NAMESPACE,
                job_name,
                "-o",
                'jsonpath={.status.succeeded}|{.status.failed}|{.status.active}|{.status.conditions[?(@.type=="Complete")].status}|{.status.conditions[?(@.type=="Failed")].status}',
            ],
            check=False,
        )

        if job_state.returncode != 0:
            if _job_not_found_error(job_state) and _has_completion_signal_in_logs(
                log_file
            ):
                _write_and_print(
                    log_file,
                    f"[wait] job object disappeared for job={job_name} after completion signals were captured; treating as success",
                )
                exit_code = "0"
                break
            if failed_without_terminal_since is not None:
                _write_and_print(
                    log_file,
                    f"[wait] unable to read job status after prior failed attempt(s); treating as terminal failure for job={job_name}",
                )
                exit_code = "1"
                break
            time.sleep(5)
            continue

        state = (job_state.stdout or "").strip()
        parts = state.split("|") if state else []
        succeeded = parts[0] if len(parts) > 0 else ""
        failed = parts[1] if len(parts) > 1 else ""
        active = parts[2] if len(parts) > 2 else ""
        complete_cond = parts[3] if len(parts) > 3 else ""
        failed_cond = parts[4] if len(parts) > 4 else ""

        if complete_cond == "True" or (succeeded.isdigit() and int(succeeded) > 0):
            exit_code = "0"
            break
        if failed_cond == "True":
            exit_code = "1"
            break

        if failed.isdigit() and int(failed) > 0:
            no_active_pods = not (active.isdigit() and int(active) > 0)
            if no_active_pods:
                if failed_without_terminal_since is None:
                    failed_without_terminal_since = time.time()
                elif (time.time() - failed_without_terminal_since) >= 90:
                    if _has_completion_signal_in_logs(log_file):
                        _write_and_print(
                            log_file,
                            f"[wait] no terminal condition for >=90s but completion signals exist in logs for job={job_name}; treating as success",
                        )
                        exit_code = "0"
                        break
                    _write_and_print(
                        log_file,
                        f"[wait] failed attempts persisted for >=90s with no active pod and no terminal condition; treating as terminal failure for job={job_name}",
                    )
                    exit_code = "1"
                    break
            else:
                failed_without_terminal_since = None
        else:
            failed_without_terminal_since = None

        time.sleep(5)
    else:
        exit_code = "1"
        _write_and_print(
            log_file,
            f"[wait] timeout while waiting for terminal job state: {job_name}",
        )

    stop_event.set()
    if stream_proc and stream_proc.poll() is None:
        try:
            stream_proc.terminate()
            stream_proc.wait(timeout=5)
        except Exception:
            try:
                stream_proc.kill()
            except Exception:
                pass
    stream_thread.join(timeout=10)
    status_thread.join(timeout=2)

    _append_file_from_cmd(
        log_file,
        [
            "kubectl",
            "logs",
            "--namespace",
            NAMESPACE,
            f"job/{job_name}",
            "--all-containers=true",
            "--prefix=true",
            "--tail=-1",
            "--pod-running-timeout=45m",
        ],
        echo_to_stdout=False,
    )

    if streamed_line_count == 0:
        _write_and_print(
            log_file,
            f"[logs] no live lines were emitted for job={job_name}; printing final pod log tail",
        )
        _append_file_from_cmd(
            log_file,
            [
                "kubectl",
                "logs",
                "--namespace",
                NAMESPACE,
                f"job/{job_name}",
                "--all-containers=true",
                "--prefix=true",
                "--tail=500",
                "--pod-running-timeout=45m",
            ],
            echo_to_stdout=True,
        )

    if exit_code != "0":
        _write_and_print(
            log_file,
            f"[diag] final pod logs (tail 200) for failed job={job_name}:",
        )
        _append_file_from_cmd(
            log_file,
            [
                "kubectl",
                "logs",
                "--namespace",
                NAMESPACE,
                f"job/{job_name}",
                "--all-containers=true",
                "--prefix=true",
                "--tail=200",
                "--pod-running-timeout=45m",
            ],
            echo_to_stdout=True,
        )

    try:
        described = _run(
            ["kubectl", "describe", "job", "--namespace", NAMESPACE, job_name],
            check=False,
        )
        describe_file.write_text(
            (described.stdout or "") + (described.stderr or ""), encoding="utf-8"
        )
    except Exception:
        pass

    try:
        _put_cloudwatch_logs(log_file, log_group_name=log_group_name, job_name=job_name)
    except Exception as exc:
        sys.stdout.write(
            f"[cloudwatch] best-effort upload skipped for job={job_name}: {exc}\n"
        )
        sys.stdout.flush()

    if (
        delete_requested
        and not _has_delete_purge_signal(log_file)
        and not _has_auth_failure_signal(log_file)
        and not _has_setup_forbidden_signal(log_file)
        and not _has_setup_auth_outage_signal(log_file)
    ):
        _write_and_print(
            log_file,
            "[wait] delete-before-upload was requested but no purge marker was found in pod logs; treating setup run as failure",
        )
        exit_code = "1"
    elif (
        exit_code != "0"
        and fail_open_create_upload_403
        and (
            _has_createupload_403_signal(log_file)
            or _has_setup_forbidden_signal(log_file)
        )
    ):
        _write_and_print(
            log_file,
            "[wait] fail-open enabled: detected setup forbidden/auth-denied signal in pod logs; treating setup run as success",
        )
        exit_code = "0"

    with open(github_output, "a", encoding="utf-8") as fh:
        fh.write(f"exit_code={exit_code}\n")

    if exit_code != "0":
        _emit_strict_fixture_mismatch_hint(log_file, requested_fixture_projects)
        sys.exit(1)


if __name__ == "__main__":
    main()
