from fastapi.testclient import TestClient

from hermes_cli import web_server
from hermes_cli.web_server import _SESSION_TOKEN, app


HEADERS = {"X-Hermes-Session-Token": _SESSION_TOKEN}


def test_voice_perf_snapshot_summarizes_percentiles_without_sensitive_text():
    with web_server._VOICE_PERF_LOCK:
        web_server._VOICE_PERF_EVENTS.clear()

    web_server._voice_perf_record(
        route="/api/audio/transcribe",
        stage="total",
        elapsed_ms=100,
        ok=True,
        provider="local",
        audio_bytes=1024,
        text_chars=12,
        profile="default",
    )
    web_server._voice_perf_record(
        route="/api/audio/transcribe",
        stage="total",
        elapsed_ms=300,
        ok=False,
        provider="local",
        audio_bytes=2048,
        text_chars=0,
        profile="default",
        error_type="provider_failed",
    )

    web_server._voice_perf_record(
        route="/api/audio/speak-stream",
        stage="first_chunk",
        elapsed_ms=12,
        ok=True,
        provider="StreamingProvider",
        audio_bytes=512,
    )

    snapshot = web_server._voice_perf_snapshot(limit=10)

    bucket = snapshot["summary"]["/api/audio/transcribe:total"]
    assert bucket["count"] == 2
    assert bucket["failures"] == 1
    assert bucket["p50_ms"] == 100
    assert bucket["p95_ms"] == 300
    assert bucket["providers"] == ["local"]
    assert snapshot["summary"]["/api/audio/speak-stream:first_chunk"]["p50_ms"] == 12
    assert snapshot["recent"][-1]["provider"] == "StreamingProvider"
    assert snapshot["recent"][-2]["error_type"] == "provider_failed"
    assert "transcript" not in str(snapshot).lower()
    assert "secret" not in str(snapshot).lower()


def test_audio_performance_endpoint_returns_backend_voice_metrics():
    with web_server._VOICE_PERF_LOCK:
        web_server._VOICE_PERF_EVENTS.clear()

    web_server._voice_perf_record(
        route="/api/audio/speak",
        stage="total",
        elapsed_ms=42.5,
        ok=True,
        provider="edge",
        audio_bytes=4096,
        text_chars=24,
    )

    client = TestClient(app)
    resp = client.get("/api/audio/performance", headers=HEADERS)

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert payload["event_count"] == 1
    assert payload["summary"]["/api/audio/speak:total"]["latest_ms"] == 42.5


def test_audio_speak_rejects_unsupported_free_edge_voice():
    client = TestClient(app)
    resp = client.post(
        "/api/audio/speak",
        headers=HEADERS,
        json={"text": "preview", "provider": "edge", "voice": "not-a-free-voice"},
    )

    assert resp.status_code == 400
    assert resp.json()["detail"] == "Unsupported free Edge voice"
