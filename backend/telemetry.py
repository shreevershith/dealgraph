"""Optional telemetry: SigNoz (OpenTelemetry) and Langfuse (LLM observability).

- SigNoz: when OTEL_EXPORTER_OTLP_TRACES_ENDPOINT (or OTEL_EXPORTER_OTLP_ENDPOINT) is set,
  instruments the FastAPI app with OpenTelemetry and exports traces via OTLP/gRPC.
- Langfuse: when LANGFUSE_SECRET_KEY is set, patches the openai module so that all
  OpenAI-compatible LLM calls (Groq, Together, OpenAI) are traced. Must be applied
  before any code imports openai (e.g. before model_config/strands use it).

Usage:
  In main.py, call setup_telemetry(app) after creating the FastAPI app.
  Langfuse openai patch must run at import time before strands/model_config — see main.py.
"""

import os
import logging

logger = logging.getLogger("dealgraph.telemetry")


def _patch_langfuse_openai() -> bool:
    """Patch the openai module with Langfuse's wrapper so Strands/Groq/Together/OpenAI are traced.
    Call this before importing strands or model_config. Returns True if patched."""
    if not os.getenv("LANGFUSE_SECRET_KEY", "").strip():
        return False
    try:
        import sys
        import langfuse.openai as _langfuse_openai
        sys.modules["openai"] = _langfuse_openai
        logger.info("Langfuse: openai module patched for LLM tracing")
        return True
    except Exception as e:
        logger.warning("Langfuse patch failed (LLM tracing disabled): %s", e)
        return False


def setup_signoz(app):
    """Instrument FastAPI with OpenTelemetry and export traces to SigNoz (OTLP).
    Call once after creating the FastAPI app. No-op if OTEL endpoint is not set."""
    endpoint = (
        os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT") or
        os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
    ).strip()
    if not endpoint:
        logger.debug("SigNoz: OTEL endpoint not set, skipping")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME

        # OTLP exporter (gRPC or HTTP depending on env)
        protocol = (os.getenv("OTEL_EXPORTER_OTLP_PROTOCOL") or "grpc").strip().lower()
        headers_str = os.getenv("OTEL_EXPORTER_OTLP_HEADERS") or os.getenv("OTEL_EXPORTER_OTLP_TRACES_HEADERS") or ""

        resource = Resource.create({
            SERVICE_NAME: os.getenv("OTEL_SERVICE_NAME", "dealgraph-backend"),
        })
        provider = TracerProvider(resource=resource)

        if protocol == "grpc":
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
            headers = {}
            for part in headers_str.split(","):
                part = part.strip()
                if "=" in part:
                    k, v = part.split("=", 1)
                    headers[k.strip()] = v.strip()
            # gRPC endpoint: use host:port (no scheme); insecure only for localhost/http
            grpc_endpoint = endpoint.replace("https://", "").replace("http://", "").rstrip("/")
            insecure = endpoint.startswith("http://") or "localhost" in grpc_endpoint or "127.0.0.1" in grpc_endpoint
            exporter = OTLPSpanExporter(
                endpoint=grpc_endpoint or None,
                insecure=insecure,
                headers=headers if headers else None,
            )
        else:
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
            exporter = OTLPSpanExporter(endpoint=endpoint)

        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)

        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        FastAPIInstrumentor.instrument_app(app)
        logger.info("SigNoz: FastAPI instrumented (OTLP endpoint=%s)", endpoint.split(".")[0] if "." in endpoint else endpoint)
    except Exception as e:
        logger.warning("SigNoz instrumentation failed: %s", e)


def setup_telemetry(app):
    """Run all telemetry setup. Call once after creating the FastAPI app."""
    setup_signoz(app)
    # Langfuse is patched at import time in main.py before strands/model_config
